// Highlight "keys" are highlight row ids. Callers sort them before passing them in (that's the cache key).

import { eq } from "drizzle-orm";
import { getDb, links } from "@/db";
import { buildPrompt } from "./prompt";
import { humanize } from "./clean";
import { complete } from "@/lib/ai";
import { demoGenerate } from "./demo";
import { focusPool, loadContext } from "./context";
import { cacheKey, countVisitDrafts, findCached, findNearest, MAX_GENERATIONS_PER_VISIT, recentTexts, storeDraft } from "./cache";
import { checkUnique, makePlan, opening, planToPrompt, tooSimilar, type Uniqueness } from "./unique";
import { readVisit } from "@/lib/visit";
import { rateLimit } from "@/lib/ratelimit";
import type { Lang } from "@/lib/i18n/languages";
import type { GenContext } from "./types";

export { buildPrompt } from "./prompt";
export { demoGenerate } from "./demo";

export type DraftLength = "short" | "detailed";

export interface DraftRequest {
  token: string;
  visit: string; // signed visit token from the page; drafts are cached per visit
  rating: number; // 0 = not rated yet, 1-5
  highlightIds: string[];
  length: DraftLength;
  variant: number; // "New draft" increments this
  ip?: string;
}

export interface DraftResult {
  text: string;
  model: string; // "demo" when no AI provider is connected
  cached: boolean;
}

export interface PreviewRequest {
  productId: string;
  rating: number;
  highlightIds: string[];
  length: DraftLength;
  notes: string;
  language?: string;
  variant?: number;
}

export class LinkInactiveError extends Error {}
export class VisitError extends Error {}

const AI_ATTEMPTS = 3;
const DEMO_CANDIDATES = 10;

/**
 * Writes one draft that differs from recent drafts and posted reviews for the product.
 * AI: up to 3 attempts, each with a new plan; keeps the most distinct one. Demo: picks the most distinct of 10 candidates.
 */
async function produce(
  ctx: GenContext,
  link: { language: string; visitNotes: string; customerName?: string },
  rating: number,
  length: DraftLength,
  variant: number,
  seed: string,
  corpus: string[],
): Promise<{ text: string; model: string; uniq: Uniqueness }> {
  const s = ctx.settings;
  const extra = s?.systemPromptExtra?.trim();
  const pool = focusPool(ctx);
  const usedOpenings = [...new Set(corpus.slice(0, 30).map(opening).filter(Boolean))].slice(0, 12);
  let best: { text: string; model: string; uniq: Uniqueness } | null = null;
  let retryNote = "";

  for (let attempt = 0; attempt < AI_ATTEMPTS; attempt++) {
    const plan = makePlan(`${seed}:${attempt}`, pool, corpus.slice(0, 20));
    const prompt = buildPrompt({
      brand: ctx.brand,
      product: ctx.product,
      examples: ctx.examples,
      memory: ctx.memory,
      inspirations: ctx.inspirations,
      link,
      rating,
      highlights: ctx.highlights,
      length,
      variant,
      plan: planToPrompt(plan, ctx.lang),
      usedOpenings,
      retryNote,
    });
    if (extra) prompt.system += `\n\nAdditional instructions:\n${extra}`;
    const temperature = Math.min(1.2, (s?.temperature ?? 0.7) + attempt * 0.15);
    const out = await complete(prompt, { temperature, maxTokens: s?.maxTokens ?? 400 });
    if (!out) break; // no provider or the call failed: fall through to the demo writer
    out.text = humanize(out.text);
    const uniq = checkUnique(out.text, corpus);
    if (!best || uniq.score < best.uniq.score || (best.uniq.sameOpening && !uniq.sameOpening)) best = { text: out.text, model: out.model, uniq };
    if (!tooSimilar(uniq, out.text)) return { text: out.text, model: out.model, uniq };
    retryNote = "Your previous attempt was too close to another customer's review. Start differently, pick a different detail and change the sentence structure.";
  }
  if (best) return best;

  let demo: { text: string; uniq: Uniqueness } | null = null;
  for (let i = 0; i < DEMO_CANDIDATES; i++) {
    const text = humanize(demoGenerate({ productName: ctx.product.name, rating, highlights: ctx.highlights, length, seed: `${seed}:d${i}`, lang: ctx.lang }));
    const uniq = checkUnique(text, corpus);
    if (!demo || uniq.score < demo.uniq.score) demo = { text, uniq };
    if (!tooSimilar(uniq, text)) break;
  }
  return { text: demo!.text, model: "demo", uniq: demo!.uniq };
}

/** One draft per (visit, rating, highlights, length, variant). Throws LinkInactiveError / VisitError. */
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const db = await getDb();
  const [link] = await db.select().from(links).where(eq(links.token, req.token)).limit(1);
  if (!link || link.status === "disabled") throw new LinkInactiveError("Link is not active");
  const visit = await readVisit(link.id, req.visit);
  if (!visit) throw new VisitError("Visit expired");
  const { visitId, lang } = visit;
  const key = { linkId: link.id, visitId, rating: req.rating, keys: cacheKey(req.highlightIds), length: req.length, variant: req.variant };
  const [hit, n] = await Promise.all([findCached(key), countVisitDrafts(link.id, visitId)]);
  if (hit) return { text: humanize(hit.text), model: hit.model, cached: true };

  // Cost guards: per visit, per IP and per link per day. Over a limit, reuse this visit's latest draft or write a demo one.
  const limited =
    n >= MAX_GENERATIONS_PER_VISIT ||
    !(await rateLimit(`gen:ip:${req.ip ?? "?"}`, 60, 60 * 60 * 1000)).ok ||
    !(await rateLimit(`gen:link:${link.id}`, 1500, 24 * 60 * 60 * 1000)).ok;

  const [ctx, corpus] = await Promise.all([loadContext(link.productId, req.rating, req.highlightIds, lang), recentTexts(link.productId)]);
  const seed = `${visitId}:${req.rating}:${key.keys}:${req.length}:${req.variant}`;

  if (limited) {
    const near = await findNearest(link.id, visitId, req.rating, req.length);
    if (near) return { text: humanize(near.text), model: near.model, cached: true };
    const text = humanize(demoGenerate({ productName: ctx.product.name, rating: req.rating, highlights: ctx.highlights, length: req.length, seed, lang }));
    return { text, model: "demo", cached: false };
  }

  const out = await produce(ctx, { ...link, language: lang }, req.rating, req.length, req.variant, seed, corpus);
  await storeDraft({ ...key, productId: link.productId, text: out.text, model: out.model });
  return { text: out.text, model: out.model, cached: false };
}

/**
 * One prompt for the Training page, so every model column gets identical input, plus the fallback
 * template draft customers would see without AI. Nothing is cached or stored.
 */
export async function trainingPrompt(req: PreviewRequest): Promise<{
  prompt: { system: string; user: string };
  fallback: string;
  temperature: number;
  maxTokens: number;
}> {
  const lang: Lang = req.language === "ja" ? "ja" : "en";
  const variant = req.variant ?? 0;
  const [ctx, corpus] = await Promise.all([loadContext(req.productId, req.rating, req.highlightIds, lang), recentTexts(req.productId)]);
  const seed = `training:${req.productId}:${req.rating}:${req.highlightIds.join(",")}:${req.length}:${variant}`;
  const prompt = buildPrompt({
    brand: ctx.brand,
    product: ctx.product,
    examples: ctx.examples,
    memory: ctx.memory,
    inspirations: ctx.inspirations,
    link: { language: lang, visitNotes: req.notes },
    rating: req.rating,
    highlights: ctx.highlights,
    length: req.length,
    variant,
    plan: planToPrompt(makePlan(seed, focusPool(ctx), corpus.slice(0, 20)), ctx.lang),
    usedOpenings: [...new Set(corpus.slice(0, 30).map(opening).filter(Boolean))].slice(0, 12),
  });
  const extra = ctx.settings?.systemPromptExtra?.trim();
  if (extra) prompt.system += `\n\nAdditional instructions:\n${extra}`;
  const fallback = humanize(demoGenerate({ productName: ctx.product.name, rating: req.rating, highlights: ctx.highlights, length: req.length, seed, lang }));
  return { prompt, fallback, temperature: ctx.settings?.temperature ?? 0.7, maxTokens: ctx.settings?.maxTokens ?? 400 };
}

/** Playground preview for /admin/training. Never cached and never tied to a link, but still kept distinct from recent drafts. */
export async function previewDraft(req: PreviewRequest): Promise<DraftResult> {
  const lang: Lang = req.language === "ja" ? "ja" : "en";
  const [ctx, corpus] = await Promise.all([loadContext(req.productId, req.rating, req.highlightIds, lang), recentTexts(req.productId)]);
  const out = await produce(
    ctx,
    { language: lang, visitNotes: req.notes },
    req.rating,
    req.length,
    req.variant ?? 0,
    `preview:${crypto.randomUUID()}`,
    corpus,
  );
  return { text: out.text, model: out.model, cached: false };
}

const STOP = new Set([
  "with", "that", "this", "were", "have", "from", "they", "very", "just", "about", "there", "their", "your", "been", "into", "than", "then", "when", "what", "which", "will", "would", "could", "should", "also", "some", "more", "most", "much", "only", "over", "such", "felt", "feel",
]);

/** Picks highlight ids whose label words appear in the visit notes (used for initial pre-selection). */
export function preselectHighlights(notes: string, highlights: { id: string; label: string; polarity: string }[]): string[] {
  const words = new Set(notes.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!words.size) return [];
  const ids: string[] = [];
  for (const h of highlights) {
    if (h.polarity !== "pos" && h.polarity !== "both") continue;
    const labelWords = h.label.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const sig = labelWords.filter((w) => w.length >= 4 && !STOP.has(w));
    if (sig.length && sig.every((w) => words.has(w))) ids.push(h.id);
  }
  return ids.sort();
}
