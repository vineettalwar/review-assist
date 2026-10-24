// Keeps every draft distinct from earlier drafts and posted reviews for the same product.
// Two parts: a seeded "plan" that steers each draft to a different angle, and a similarity check after writing.
import type { Lang } from "@/lib/i18n/languages";

const CJK = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

function norm(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Word bigrams for spaced languages, character bigrams for Japanese/Chinese. */
function shingles(text: string): Set<string> {
  const t = norm(text);
  const out = new Set<string>();
  if (CJK.test(t)) {
    const c = t.replace(/\s+/g, "");
    for (let i = 0; i < c.length - 1; i++) out.add(c.slice(i, i + 2));
  } else {
    const w = t.split(" ").filter(Boolean);
    for (let i = 0; i < w.length - 1; i++) out.add(w[i] + " " + w[i + 1]);
    if (w.length === 1) out.add(w[0]);
  }
  return out;
}

/** Overlap of the smaller text's shingles with the other's (0..1). Catches copies, near-copies and shared openings. */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  for (const s of small) if (big.has(s)) hit++;
  return hit / small.size;
}

/** The first few words (or ~12 characters in Japanese), normalized, for opening reuse checks. */
export function opening(text: string): string {
  const t = norm(text);
  if (CJK.test(t)) return t.replace(/\s+/g, "").slice(0, 12);
  return t.split(" ").slice(0, 5).join(" ");
}

export interface Uniqueness {
  score: number; // highest similarity to any earlier text
  sameOpening: boolean;
}

export function checkUnique(text: string, corpus: string[]): Uniqueness {
  const open = opening(text);
  let score = 0;
  let sameOpening = false;
  for (const c of corpus) {
    if (!c) continue;
    score = Math.max(score, similarity(text, c));
    if (open && opening(c) === open) sameOpening = true;
  }
  return { score, sameOpening };
}

/** Above this, a draft reads as a rewrite of an earlier one. Short drafts share more bigrams by chance. */
export function tooSimilar(u: Uniqueness, text: string) {
  const short = shingles(text).size < 14;
  return u.sameOpening || u.score > (short ? 0.62 : 0.5);
}

// ---------- seeded plan ----------

/** Small deterministic PRNG (mulberry32) from a string seed. */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

const OPENINGS = [
  "Open with the single moment or detail that stuck with you most.",
  "Open with your overall verdict in plain words, then explain.",
  "Open with what you needed or were looking for before you chose this.",
  "Open with how things went compared with what you expected.",
  "Open mid-experience, describing what happened, and give the verdict later.",
  "Open with who you would (or would not) recommend this to.",
  "Open with a short, direct statement about the result.",
] as const;

const STRUCTURES = [
  "Order: situation, what happened, how you feel now.",
  "Order: verdict, one concrete reason, a small closing remark.",
  "Order: the detail you noticed first, then the overall impression.",
  "Order: what worked, what could be better (only if the rating allows), bottom line.",
  "Keep it conversational, like telling a friend, with one specific detail.",
  "Keep it compact and factual, like a busy person writing on their phone.",
] as const;

const VOICES = [
  "Plain everyday words, medium-length sentences.",
  "Short sentences. Understated.",
  "Relaxed and personal, a little informal.",
  "Measured and specific, no exclamation marks.",
  "Friendly, with one natural aside.",
] as const;

export interface Plan {
  opening: string;
  structure: string;
  voice: string;
  focus: string; // one context line to lean on, or ""
}

/** Picks a writing plan from the seed, leaning on a product context line that recent drafts haven't used. */
export function makePlan(seed: string, focusPool: string[], recent: string[]): Plan {
  const r = rng(seed);
  const fresh = focusPool.filter((f) => !recent.some((t) => similarity(f, t) > 0.5));
  const pool = fresh.length ? fresh : focusPool;
  return {
    opening: pick(r, OPENINGS),
    structure: pick(r, STRUCTURES),
    voice: pick(r, VOICES),
    focus: pool.length ? pick(r, pool) : "",
  };
}

export function planToPrompt(p: Plan, lang: Lang): string {
  const lines = [
    "How to make this draft different from other customers' reviews:",
    `- ${p.opening}`,
    `- ${p.structure}`,
    `- Voice: ${p.voice}`,
  ];
  if (p.focus) lines.push(`- If it fits the rating and highlights, lean on this point (only as stated, no new facts): ${p.focus}`);
  if (lang === "ja") lines.push("- Apply these to natural Japanese; do not translate the instructions literally.");
  if (lang === "de") lines.push("- Apply these to natural German; do not translate the instructions literally.");
  return lines.join("\n");
}
