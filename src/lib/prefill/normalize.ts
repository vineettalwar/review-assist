// Pure: model-output parsing/validation and the heuristic "basic" fallback.
import type { PrefillBrand, PrefillProduct, PrefillResult } from "./index";
import type { PageInfo } from "./extract";

type Polarity = "pos" | "neg" | "both";
const VOICES = ["warm", "professional", "casual", "brief"] as const;

export const DEFAULT_HIGHLIGHTS: PrefillProduct["highlights"] = [
  { label: "Quality", polarity: "pos" },
  { label: "Value for money", polarity: "pos" },
  { label: "Customer service", polarity: "pos" },
  { label: "Delivery", polarity: "both" },
  { label: "Price", polarity: "neg" },
];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max) : "");

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  for (const cand of [t, t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)]) {
    try {
      const v = JSON.parse(cand);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* next */
    }
  }
  return null;
}

function normHighlights(v: unknown): PrefillProduct["highlights"] {
  const out: PrefillProduct["highlights"] = [];
  if (Array.isArray(v)) {
    for (const h of v) {
      const o = (typeof h === "string" ? { label: h } : h) as { label?: unknown; polarity?: unknown } | null;
      const label = str(o?.label, 40);
      if (!label || out.some((x) => x.label.toLowerCase() === label.toLowerCase())) continue;
      const p = o?.polarity;
      out.push({ label, polarity: p === "neg" || p === "both" || p === "pos" ? (p as Polarity) : "pos" });
    }
  }
  const trimmed = out.slice(0, 9);
  if (trimmed.length < 5) {
    for (const d of DEFAULT_HIGHLIGHTS) {
      if (trimmed.length >= 5) break;
      if (!trimmed.some((x) => x.label.toLowerCase() === d.label.toLowerCase())) trimmed.push({ ...d });
    }
  }
  if (!trimmed.some((h) => h.polarity !== "pos")) {
    trimmed.push({ label: "Price", polarity: "neg" });
    if (trimmed.length > 9) trimmed.splice(trimmed.length - 2, 1);
  }
  return trimmed;
}

export function normalizeModelResult(
  raw: string,
  ctx: { sources: string[]; productUrls: string[]; fallbackName: string; brandUrl?: string; maxProducts?: number },
): Omit<PrefillResult, "warnings" | "mode"> | null {
  const o = parseJsonObject(raw);
  if (!o) return null;
  const b = (o.brand ?? {}) as Record<string, unknown>;
  const voice = VOICES.find((x) => x === b.voice) ?? "warm";
  const brand: PrefillBrand = {
    name: str(b.name, 120) || ctx.fallbackName,
    about: str(b.about, 600),
    audience: str(b.audience, 400),
    facts: str(b.facts, 1000),
    voice,
    voiceNotes: str(b.voiceNotes, 400),
    wordsToAvoid: str(b.wordsToAvoid, 200),
    defaultLanguage: /^[a-z]{2}(-[A-Za-z]{2})?$/.test(str(b.defaultLanguage, 8)) ? str(b.defaultLanguage, 8) : "en",
  };
  const products: PrefillProduct[] = [];
  if (Array.isArray(o.products)) {
    for (const p of o.products.slice(0, ctx.maxProducts ?? 3)) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      const name = str(r.name, 120);
      if (!name) continue;
      const idx = products.length;
      products.push({
        name,
        category: str(r.category, 60),
        url: ctx.productUrls[idx] ?? (typeof r.url === "string" && ctx.sources.includes(r.url) ? r.url : ""),
        knowledge: str(r.knowledge, 1500),
        audience: str(r.audience, 400),
        experience: str(r.experience, 800),
        praise: str(r.praise, 800),
        concerns: str(r.concerns, 600),
        avoid: str(r.avoid, 400),
        highlights: normHighlights(r.highlights),
      });
    }
  }
  const memories: PrefillResult["memories"] = [];
  if (Array.isArray(o.memories)) {
    for (const m of o.memories) {
      if (!m || typeof m !== "object") continue;
      const r = m as Record<string, unknown>;
      const text = str(r.text, 200);
      const kind = r.kind === "style" || r.kind === "avoid" || r.kind === "fact" ? r.kind : null;
      if (!text || !kind) continue;
      const pi = typeof r.productIndex === "number" && Number.isInteger(r.productIndex) && r.productIndex >= 0 && r.productIndex < products.length ? r.productIndex : null;
      memories.push({ kind, text, productIndex: pi });
      if (memories.length >= 8) break;
    }
  }
  return { brand, products, memories, sources: ctx.sources };
}

const JUNK = /cart|oops|error|notify|subscribe|sign ?up|log ?in|cookie|newsletter|something went wrong|access denied/i;
const stripSite = (t: string) => t.split(/\s+[|–—-]\s+/)[0]?.trim() ?? t;

/** Without a model: up to 5 concrete-looking sentences (they carry a number) from the page body, verbatim. */
function factSentences(body: string): string[] {
  const out: string[] = [];
  for (const raw of body.replace(/\[\s*\d+\s*\]/g, " ").split(/(?<=[.!?])\s+/)) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 40 || t.length > 220 || !/\d/.test(t) || JUNK.test(t) || !/[.!?]$/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

export function basicResult(
  pages: { page: PageInfo; isProduct: boolean }[],
  opts: { brandName?: string; warnings: string[] },
): PrefillResult {
  const brandPage = pages.find((p) => !p.isProduct)?.page ?? pages[0]?.page;
  const name =
    opts.brandName?.trim() ||
    brandPage?.siteName ||
    (brandPage ? stripSite(brandPage.ogTitle || brandPage.title) : "") ||
    "";
  const brand: PrefillBrand = {
    name: JUNK.test(name) ? opts.brandName?.trim() || "" : name,
    about: (brandPage?.description || brandPage?.ogDescription || "").slice(0, 600),
    audience: "",
    facts: "",
    voice: "warm",
    voiceNotes: "",
    wordsToAvoid: "",
    defaultLanguage: "en",
  };
  const prodPages = pages.filter((p) => p.isProduct);
  const src = prodPages.length ? prodPages : brandPage ? [{ page: brandPage, isProduct: false }] : [];
  const products: PrefillProduct[] = src.slice(0, 3).map(({ page }) => {
    const heads = page.headings.filter((h) => !JUNK.test(h));
    const titleLc = (page.ogTitle || page.title).toLowerCase();
    const match = heads.find((h) => titleLc.includes(h.toLowerCase()));
    const pname = (match || stripSite(page.ogTitle || page.title) || heads[0]) || name;
    const lines = [page.description || page.ogDescription, ...factSentences(page.body)].filter(Boolean);
    return {
      name: pname.slice(0, 120),
      category: "",
      url: page.url,
      knowledge: [...new Set(lines)].join("\n").slice(0, 1500),
      audience: "",
      experience: "",
      praise: "",
      concerns: "",
      avoid: "",
      highlights: DEFAULT_HIGHLIGHTS.map((h) => ({ ...h })),
    };
  });
  return {
    brand,
    products,
    memories: [],
    sources: pages.map((p) => p.page.url),
    mode: "basic",
    warnings: opts.warnings,
  };
}
