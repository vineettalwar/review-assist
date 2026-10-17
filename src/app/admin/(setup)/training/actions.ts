"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, examples, products } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { previewDraft, type DraftLength } from "@/lib/generation";
import { qs } from "../flash";

export type PreviewInput = {
  productId: string;
  rating: number;
  highlightIds: string[];
  length: DraftLength;
  notes: string;
  language: string;
  variant: number;
};
export type PreviewOutput = { ok: true; text: string; model: string } | { ok: false; error: string };

async function activeOrRedirect() {
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  return active;
}

export async function runPreview(input: PreviewInput): Promise<PreviewOutput> {
  await requireAdmin();
  const active = await activeOrRedirect();
  if (!input.productId || typeof input.productId !== "string") return { ok: false, error: "Pick a product first." };
  const highlightIds = (Array.isArray(input.highlightIds) ? input.highlightIds : []).filter((x) => typeof x === "string" && x.length <= 64).slice(0, 10);
  const db = await getDb();
  const [own] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.brandId, active.id)));
  if (!own) return { ok: false, error: "That product isn't in this brand." };
  try {
    const r = await previewDraft({
      productId: input.productId,
      rating: Math.min(5, Math.max(0, Math.round(Number(input.rating) || 0))),
      highlightIds: highlightIds.sort(),
      length: input.length === "detailed" ? "detailed" : "short",
      notes: String(input.notes ?? "").slice(0, 1000),
      language: String(input.language ?? "").slice(0, 16),
      variant: Math.min(50, Math.max(0, Math.round(Number(input.variant) || 0))),
    });
    return { ok: true, text: r.text, model: r.model };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? `Couldn't generate a draft: ${e.message}` : "Couldn't generate a draft. Try again." };
  }
}

export async function saveExampleFromPlayground(input: { productId: string; rating: number; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const text = String(input?.text ?? "").trim().slice(0, 5000);
  if (typeof input.productId !== "string") return { ok: false, error: "That product no longer exists." };
  if (!input.rating || input.rating < 1 || input.rating > 5) return { ok: false, error: "Pick a star rating before saving. Examples need one." };
  if (!text) return { ok: false, error: "There's no text to save." };
  const db = await getDb();
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.brandId, active.id)));
  if (!p) return { ok: false, error: "That product no longer exists." };
  await db.insert(examples).values({
    id: crypto.randomUUID(),
    brandId: active.id,
    productId: p.id,
    rating: Math.round(input.rating),
    text,
    source: "playground",
    createdAt: Date.now(),
  });
  revalidatePath("/admin/products", "layout");
  return { ok: true };
}

async function readExample(formData: FormData, brandId: string) {
  const rating = Number(formData.get("rating"));
  const text = String(formData.get("text") ?? "").trim().slice(0, 5000);
  const pid = String(formData.get("productId") ?? "");
  let productId: string | null = null;
  if (pid) {
    const db = await getDb();
    const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, pid), eq(products.brandId, brandId)));
    productId = p?.id ?? null;
  }
  return { rating, text, productId };
}

/** Where to send the admin back to: the product page when the example was added there, else Products. */
function backTo(formData: FormData) {
  const r = String(formData.get("returnTo") ?? "");
  return /^\/admin\/products\/[\w-]+$/.test(r) ? r : "/admin/products";
}

export async function addExample(formData: FormData) {
  await requireAdmin();
  const active = await activeOrRedirect();
  const e = await readExample(formData, active.id);
  if (!Number.isInteger(e.rating) || e.rating < 1 || e.rating > 5 || !e.text) {
    redirect(backTo(formData) + qs({ error: "An example needs a rating from 1 to 5 and some text." }) + "#examples");
  }
  const db = await getDb();
  await db.insert(examples).values({ id: crypto.randomUUID(), brandId: active.id, ...e, source: "manual", createdAt: Date.now() });
  revalidatePath("/admin/products", "layout");
  revalidatePath(backTo(formData));
  redirect(backTo(formData) + qs({ saved: "Example added." }) + "#examples");
}

export async function updateExample(id: string, formData: FormData) {
  await requireAdmin();
  const active = await activeOrRedirect();
  const e = await readExample(formData, active.id);
  if (!Number.isInteger(e.rating) || e.rating < 1 || e.rating > 5 || !e.text) {
    redirect(backTo(formData) + qs({ error: "An example needs a rating from 1 to 5 and some text." }) + "#examples");
  }
  const db = await getDb();
  await db.update(examples).set(e).where(and(eq(examples.id, id), eq(examples.brandId, active.id)));
  revalidatePath("/admin/products", "layout");
  revalidatePath(backTo(formData));
  redirect(backTo(formData) + qs({ saved: "Example updated." }) + "#examples");
}

export async function deleteExample(id: string, formData?: FormData) {
  await requireAdmin();
  const active = await activeOrRedirect();
  const db = await getDb();
  await db.delete(examples).where(and(eq(examples.id, id), eq(examples.brandId, active.id)));
  const back = formData ? backTo(formData) : "/admin/products";
  revalidatePath("/admin/products", "layout");
  revalidatePath(back);
  redirect(back + qs({ saved: "Example deleted." }) + "#examples");
}
