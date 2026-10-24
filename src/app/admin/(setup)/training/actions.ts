"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, examples, inspirations, products, settings } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { previewDraft, trainingPrompt, withExtra, type DraftLength } from "@/lib/generation";
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
  | { ok: true; text: string; provider: ProviderId; model: string; usage: Usage | null; ms: number; raw: unknown }
  | { ok: false; error: string; provider: string; model: string; ms: number; raw: unknown };
/** The editable request shown per column (the model is filled in per column). */
export type TrainingRequest = { temperature: number; max_tokens: number; system: string; user: string; extra_instructions: string };
export type TrainingOutput = { ok: true; fallback: string; request: TrainingRequest; columns: TrainingResult[] } | { ok: false; error: string };

const MODEL_ID = /^[\w.:/-]{1,120}$/;
const RAW_CAP = 20_000;

/** Provider response for display, cut down when huge so it never bloats the page. */
function capRaw(raw: unknown): unknown {
  try {
    const s = JSON.stringify(raw);
    return s && s.length > RAW_CAP ? { truncated: true, preview: s.slice(0, RAW_CAP) } : raw;
  } catch {
    return null;
  }
}

async function runOne(
  c: TrainingColumn,
  prompt: { system: string; user: string },
  cfg: { temperature: number; maxTokens: number },
  brandId: string,
): Promise<TrainingResult> {
  const model = String(c?.model ?? "").trim();
  if (!isProviderId(c?.provider)) return { ok: false, error: "Pick a provider.", provider: String(c?.provider ?? ""), model, ms: 0, raw: null };
  if (!MODEL_ID.test(model)) return { ok: false, error: "Enter a model name, e.g. openai/gpt-4o-mini.", provider: c.provider, model, ms: 0, raw: null };
  const r = await completeWith({ provider: c.provider, model }, prompt, cfg, { source: "training", brandId });
  return r.ok
    ? { ok: true, text: r.text, provider: r.provider, model: r.model, usage: r.usage, ms: r.ms, raw: capRaw(r.raw) }
    : { ...r, raw: capRaw(r.raw) };
}

/** Runs the same prompt on each chosen model (one attempt each, so the comparison is fair) and writes the fallback draft. */
export async function runTraining(input: PreviewInput, columns: TrainingColumn[]): Promise<TrainingOutput> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const req = await ownedPreview(input, active.id);
  if (!req) return { ok: false, error: "Pick a service from this brand first." };
  const cols = (Array.isArray(columns) ? columns : []).slice(0, 3);
  try {
    const t = await trainingPrompt(req);
    const prompt = { system: withExtra(t.prompt.system, t.extra), user: t.prompt.user };
    const results = await Promise.all(cols.map((c) => runOne(c, prompt, { temperature: t.temperature, maxTokens: t.maxTokens }, active.id)));
    return {
      ok: true,
      fallback: t.fallback,
      request: { temperature: t.temperature, max_tokens: t.maxTokens, system: t.prompt.system, user: t.prompt.user, extra_instructions: t.extra },
      columns: results,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? `Couldn't generate: ${e.message}` : "Couldn't generate. Try again." };
  }
}

const REQUEST_KEYS = ["model", "temperature", "max_tokens", "system", "user", "extra_instructions"];

/** Validates the JSON edited on the Training page. Only these keys; keys and headers are never part of it. */
function parseRequest(raw: string): { ok: true; model: string; temperature: number; maxTokens: number; system: string; user: string; extra: string } | { ok: false; error: string } {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `That isn't valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "The request must be a JSON object." };
  const r = o as Record<string, unknown>;
  const unknown = Object.keys(r).filter((k) => !REQUEST_KEYS.includes(k));
  if (unknown.length) return { ok: false, error: `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Allowed: ${REQUEST_KEYS.join(", ")}.` };
  const model = typeof r.model === "string" ? r.model.trim() : "";
  if (!MODEL_ID.test(model)) return { ok: false, error: "\"model\" must be a model name, e.g. openai/gpt-4o-mini." };
  const temperature = typeof r.temperature === "number" ? r.temperature : NaN;
  if (!(temperature >= 0 && temperature <= 2)) return { ok: false, error: "\"temperature\" must be a number from 0 to 2." };
  const maxTokens = typeof r.max_tokens === "number" ? r.max_tokens : NaN;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4000) return { ok: false, error: "\"max_tokens\" must be a whole number from 1 to 4000." };
  const text = (k: string, required: boolean) => {
    const v = r[k];
    if (v === undefined && !required) return "";
    return typeof v === "string" && v.length <= 20_000 ? v : null;
  };
  const system = text("system", true);
  const user = text("user", true);
  const extra = text("extra_instructions", false);
  if (system === null || !system.trim()) return { ok: false, error: "\"system\" must be text (up to 20,000 characters)." };
  if (user === null || !user.trim()) return { ok: false, error: "\"user\" must be text (up to 20,000 characters)." };
  if (extra === null) return { ok: false, error: "\"extra_instructions\" must be text (up to 20,000 characters)." };
  return { ok: true, model, temperature, maxTokens, system, user, extra };
}

/** Sends exactly the edited request to one provider. Nothing reaches customers. */
export async function runRawRequest(input: { provider: string; request: string }): Promise<{ ok: true; result: TrainingResult } | { ok: false; error: string }> {
  await requireAdmin();
  const active = await activeOrRedirect();
  const p = parseRequest(String(input?.request ?? "").slice(0, 70_000));
  if (!p.ok) return p;
  const result = await runOne(
    { provider: String(input?.provider ?? ""), model: p.model },
    { system: withExtra(p.system, p.extra), user: p.user },
    { temperature: p.temperature, maxTokens: p.maxTokens },
    active.id,
  );
  return { ok: true, result };
}

/** Makes edited extra instructions the default for every customer draft (Settings are shared by all brands). */
export async function saveDefaultExtra(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const extra = String(text ?? "").trim();
  if (extra.length > 4000) return { ok: false, error: "Keep extra instructions under 4,000 characters." };
  const db = await getDb();
  const [s] = await db.select({ id: settings.id }).from(settings).where(eq(settings.id, "default")).limit(1);
  if (s) await db.update(settings).set({ systemPromptExtra: extra }).where(eq(settings.id, "default"));
  else await db.insert(settings).values({ id: "default", systemPromptExtra: extra });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/training");
  return { ok: true };
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
