"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, examples, inspirations, products } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { previewDraft, trainingPrompt, type DraftLength } from "@/lib/generation";
import { completeWith, isProviderId, type ProviderId, type Usage } from "@/lib/ai";
import { addMemories } from "@/lib/memory";
import { qs } from "../flash";
import { DISLIKE_REASONS } from "./reasons";

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

/** Same validation as runPreview, shared by the Training page. */
async function ownedPreview(input: PreviewInput, brandId: string) {
  if (!input?.productId || typeof input.productId !== "string") return null;
  const db = await getDb();
  const [own] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.brandId, brandId)));
  if (!own) return null;
  const highlightIds = (Array.isArray(input.highlightIds) ? input.highlightIds : []).filter((x) => typeof x === "string" && x.length <= 64).slice(0, 10);
  return {
    productId: own.id,
    rating: Math.min(5, Math.max(0, Math.round(Number(input.rating) || 0))),
    highlightIds: highlightIds.sort(),
    length: (input.length === "detailed" ? "detailed" : "short") as DraftLength,
    notes: String(input.notes ?? "").slice(0, 1000),
    language: String(input.language ?? "").slice(0, 16),
    variant: Math.min(50, Math.max(0, Math.round(Number(input.variant) || 0))),
  };
}

export type TrainingColumn = { provider: string; model: string };
export type TrainingResult =
  | { ok: true; text: string; provider: ProviderId; model: string; usage: Usage | null; ms: number }
  | { ok: false; error: string; provider: string; model: string; ms: number };
export type TrainingOutput = { ok: true; fallback: string; columns: TrainingResult[] } | { ok: false; error: string };

const MODEL_ID = /^[\w.:/-]{1,120}$/;

/** Runs the same prompt on each chosen model (one attempt each, so the comparison is fair) and writes the fallback draft. */
export async function runTraining(input: PreviewInput, columns: TrainingColumn[]): Promise<TrainingOutput> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const req = await ownedPreview(input, active.id);
  if (!req) return { ok: false, error: "Pick a service from this brand first." };
  const cols = (Array.isArray(columns) ? columns : []).slice(0, 2);
  try {
    const t = await trainingPrompt(req);
    const results = await Promise.all(
      cols.map(async (c): Promise<TrainingResult> => {
        const model = String(c?.model ?? "").trim();
        if (!isProviderId(c?.provider)) return { ok: false, error: "Pick a provider.", provider: String(c?.provider ?? ""), model, ms: 0 };
        if (!MODEL_ID.test(model)) return { ok: false, error: "Enter a model name, e.g. openai/gpt-4o-mini.", provider: c.provider, model, ms: 0 };
        const r = await completeWith({ provider: c.provider, model }, t.prompt, { temperature: t.temperature, maxTokens: t.maxTokens });
        return r.ok ? { ok: true, text: r.text, provider: r.provider, model: r.model, usage: r.usage, ms: r.ms } : r;
      }),
    );
    return { ok: true, fallback: t.fallback, columns: results };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? `Couldn't generate: ${e.message}` : "Couldn't generate. Try again." };
  }
}

type Scope = { productId: string | null; scope: "brand" | "product" };

/** The product id to save under: null for brand-wide, or the product when it belongs to the active brand. */
async function scopedProduct(s: Scope, brandId: string): Promise<string | null | false> {
  if (s?.scope !== "product") return null;
  if (typeof s.productId !== "string") return false;
  const db = await getDb();
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, s.productId), eq(products.brandId, brandId)));
  return p ? p.id : false;
}

function rulesChanged(productId: string | null) {
  revalidatePath("/admin/memory");
  revalidatePath("/admin/training");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

/** A dislike becomes short style rules (never a stored bad draft: models tend to copy what they're shown). */
export async function dislikeDraft(input: Scope & { reasons: string[]; note: string; draft: string }): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const productId = await scopedProduct(input, active.id);
  if (productId === false) return { ok: false, error: "That service isn't in this brand." };
  const keys = new Set(Array.isArray(input.reasons) ? input.reasons : []);
  const rules: string[] = DISLIKE_REASONS.filter((r) => keys.has(r.key)).map((r) => r.rule);
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (note) rules.push(note);
  if (!rules.length) return { ok: false, error: "Pick a reason or write what's wrong." };
  const rows = await addMemories(
    rules.map((text) => ({ brandId: active.id, productId, kind: "style" as const, text, source: "playground" as const, status: "active" as const, evidence: String(input.draft ?? "") })),
  );
  rulesChanged(productId);
  return { ok: true, saved: rows.length };
}

export async function neverSay(input: Scope & { phrase: string }): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const productId = await scopedProduct(input, active.id);
  if (productId === false) return { ok: false, error: "That service isn't in this brand." };
  const phrase = String(input.phrase ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim();
  if (!phrase) return { ok: false, error: "Select the words in a draft first." };
  if (phrase.length > 80) return { ok: false, error: "Select a shorter phrase (80 characters or fewer)." };
  const rows = await addMemories([{ brandId: active.id, productId, kind: "style", text: `Never use the phrase "${phrase}".`, source: "playground", status: "active" }]);
  rulesChanged(productId);
  return { ok: true, saved: rows.length };
}

export async function addInspiration(input: Scope & { text: string; note: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const productId = await scopedProduct(input, active.id);
  if (productId === false) return { ok: false, error: "That service isn't in this brand." };
  const text = String(input.text ?? "").trim().slice(0, 2000);
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (text.length < 20) return { ok: false, error: "Paste at least a sentence or two of writing you like." };
  const db = await getDb();
  await db.insert(inspirations).values({ id: crypto.randomUUID(), brandId: active.id, productId, text, note, active: true, createdAt: Date.now() });
  revalidatePath("/admin/training");
  return { ok: true };
}

export async function setInspirationActive(id: string, on: boolean): Promise<void> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const db = await getDb();
  await db.update(inspirations).set({ active: !!on }).where(and(eq(inspirations.id, String(id)), eq(inspirations.brandId, active.id)));
  revalidatePath("/admin/training");
}

export async function deleteInspiration(id: string): Promise<void> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const db = await getDb();
  await db.delete(inspirations).where(and(eq(inspirations.id, String(id)), eq(inspirations.brandId, active.id)));
  revalidatePath("/admin/training");
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
