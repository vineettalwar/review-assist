"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, products } from "@/db";
import { and, eq } from "drizzle-orm";
import { getActiveBrand } from "@/lib/brand";
import { addMemories, setMemoryStatus, updateMemoryText, learnFromSubmissions, proposeFromEdit, type MemoryKind } from "@/lib/memory";
import { qs } from "../flash";

const KINDS: MemoryKind[] = ["fact", "style", "avoid"];

async function ctx(formData?: FormData) {
  await requireAdmin();
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const raw = String(formData?.get("returnTo") ?? "/admin/memory");
  // Same-origin admin paths only: no "//host", "/\\host", control chars, or "/admin.evil".
  const returnTo = /^\/admin\/[^\\\s]*$/.test(raw) && !raw.startsWith("//") && raw.length <= 300 ? raw : "/admin/memory";
  return { active, returnTo };
}

function done(returnTo: string, params: Record<string, string>): never {
  revalidatePath("/admin/memory");
  revalidatePath("/admin/brand");
  revalidatePath("/admin/products", "layout");
  const [path, hash] = returnTo.split("#");
  redirect(path + qs(params) + (hash ? `#${hash}` : ""));
}

function errMsg(e: unknown) {
  return e instanceof Error && e.message ? e.message : "Something went wrong. Try again.";
}

export async function addMemory(formData: FormData) {
  const { active, returnTo } = await ctx(formData);
  const text = String(formData.get("text") ?? "").trim().slice(0, 200);
  const kind = String(formData.get("kind") ?? "fact") as MemoryKind;
  const productId = String(formData.get("productId") ?? "") || null;
  if (!text || !KINDS.includes(kind)) done(returnTo, { error: "A memory needs a kind and a sentence." });
  if (productId) {
    const db = await getDb();
    const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.brandId, active.id)));
    if (!p) done(returnTo, { error: "That product isn't in this brand." });
  }
  let ok = "";
  try {
    const rows = await addMemories([{ brandId: active.id, productId, kind, text, source: "admin", status: "active" }]);
    ok = rows.length ? "Memory added." : "That memory already exists.";
  } catch (e) {
    done(returnTo, { error: errMsg(e) });
  }
  done(returnTo, { saved: ok });
}

export async function updateMemory(id: string, formData: FormData) {
  const { active, returnTo } = await ctx(formData);
  const text = String(formData.get("text") ?? "").trim().slice(0, 200);
  const kind = String(formData.get("kind") ?? "fact") as MemoryKind;
  if (!text || !KINDS.includes(kind)) done(returnTo, { error: "A memory needs a kind and a sentence." });
  try {
    await updateMemoryText(active.id, id, text, kind);
  } catch (e) {
    done(returnTo, { error: errMsg(e) });
  }
  done(returnTo, { saved: "Memory updated." });
}

async function setStatus(id: string, status: "active" | "archived", formData: FormData, message: string) {
  const { active, returnTo } = await ctx(formData);
  try {
    await setMemoryStatus(active.id, id, status);
  } catch (e) {
    done(returnTo, { error: errMsg(e) });
  }
  done(returnTo, { saved: message });
}

export async function approveMemory(id: string, formData: FormData) {
  return setStatus(id, "active", formData, "Approved. It will be used in drafts.");
}

export async function archiveMemory(id: string, formData: FormData) {
  return setStatus(id, "archived", formData, "Archived.");
}

export async function learnFromEdits(formData: FormData) {
  const { active, returnTo } = await ctx(formData);
  let msg = "";
  try {
    const r = await learnFromSubmissions(active.id);
    msg = `Read ${r.read} edited review${r.read === 1 ? "" : "s"}, proposed ${r.proposed.length} memor${r.proposed.length === 1 ? "y" : "ies"}.`;
    if (r.read > 0 && r.proposed.length === 0) msg += " (Nothing is learned until an AI provider is connected in Settings.)";
  } catch (e) {
    done(returnTo, { error: errMsg(e) });
  }
  done(returnTo, { saved: msg });
}

/** Playground: the admin edited a generated draft, so ask what the edit teaches. */
export async function proposeFromPlayground(input: { productId: string; original: string; edited: string }): Promise<{ count: number }> {
  await requireAdmin();
  const active = await getActiveBrand();
  if (!active || typeof input?.original !== "string" || typeof input.edited !== "string" || typeof input.productId !== "string") return { count: 0 };
  if (!input.original.trim() || input.original.trim() === input.edited.trim()) return { count: 0 };
  const db = await getDb();
  const [own] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.brandId, active.id))).limit(1);
  if (!own) return { count: 0 };
  try {
    const rows = await proposeFromEdit({ brandId: active.id, productId: input.productId, original: input.original, edited: input.edited });
    revalidatePath("/admin/memory");
    return { count: rows.length };
  } catch {
    return { count: 0 };
  }
}
