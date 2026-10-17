// Pure helpers for memory: normalisation, similarity, model-output parsing. No I/O.

export type Kind = "fact" | "style" | "avoid";
export interface Lesson {
  kind: Kind;
  text: string;
}

export const MAX_MEMORY_CHARS = 200;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccard(a: string, b: string): number {
  const A = new Set(normalizeText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function isSimilar(a: string, b: string, threshold = 0.8): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb || jaccard(a, b) >= threshold;
}

export function clampText(s: string, max = MAX_MEMORY_CHARS): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export function excerpt(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

/** Extract a JSON value from model output, tolerating ```json fences and surrounding prose. */
export function extractJson(raw: string): unknown {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    /* try bracket slice */
  }
  const starts = [t.indexOf("["), t.indexOf("{")].filter((i) => i >= 0);
  if (!starts.length) return null;
  const s = Math.min(...starts);
  const closer = t[s] === "[" ? "]" : "}";
  const e = t.lastIndexOf(closer);
  if (e <= s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

/** Parse model output into validated lessons (max `limit`). Returns [] on any failure. */
export function parseLessons(raw: string | null, limit = 3): Lesson[] {
  if (!raw) return [];
  let data = extractJson(raw);
  if (data && !Array.isArray(data) && typeof data === "object") {
    const o = data as Record<string, unknown>;
    data = o.lessons ?? o.items ?? o.memories ?? null;
  }
  if (!Array.isArray(data)) return [];
  const out: Lesson[] = [];
  for (const it of data) {
    if (!it || typeof it !== "object") continue;
    const { kind, text } = it as { kind?: unknown; text?: unknown };
    if (kind !== "style" && kind !== "avoid" && kind !== "fact") continue;
    if (typeof text !== "string") continue;
    const t = clampText(text);
    if (t.length < 4) continue;
    if (out.some((x) => isSimilar(x.text, t))) continue;
    out.push({ kind, text: t });
    if (out.length >= limit) break;
  }
  return out;
}

/** Compact word-level diff summary: removed/added fragments. */
export function compactDiff(before: string, after: string, max = 300): string {
  return `${excerpt(before, Math.floor(max / 2) - 2)} → ${excerpt(after, Math.floor(max / 2) - 2)}`;
}
