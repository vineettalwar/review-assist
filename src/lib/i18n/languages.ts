/** Review languages with full support: customer page UI, draft writing and demo drafts. */
export const REVIEW_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "de", label: "German", native: "Deutsch" },
] as const;

export type Lang = (typeof REVIEW_LANGUAGES)[number]["code"];

export const isLang = (v: unknown): v is Lang => v === "en" || v === "ja" || v === "de";

/** The language a product's market is reviewed in, or null when the product has no fixed market. */
export function marketLang(market: string | null | undefined): Lang | null {
  return market === "US" ? "en" : market === "DE" ? "de" : market === "JP" ? "ja" : null;
}

/** A highlight chip's label in the page language, falling back to the English label. */
export function chipLabel(h: { label: string; labelJa?: string; labelDe?: string }, lang: Lang | string): string {
  if (lang === "ja" && h.labelJa) return h.labelJa;
  if (lang === "de" && h.labelDe) return h.labelDe;
  return h.label;
}

/** Parses settings.languages; always returns at least English. */
export function parseLanguages(raw: string | null | undefined): Lang[] {
  try {
    const arr = JSON.parse(raw || "[]");
    const out = Array.isArray(arr) ? arr.filter(isLang) : [];
    return out.length ? [...new Set(out)] : ["en"];
  } catch {
    return ["en"];
  }
}

/** Picks the page language among enabled ones: ?lang, then `preferred`, then the browser, then `fallback`. */
export function pickLang(enabled: Lang[], opts: { query?: string | null; preferred?: string | null; acceptLanguage?: string | null; fallback?: string | null }): Lang {
  if (isLang(opts.query) && enabled.includes(opts.query)) return opts.query;
  if (isLang(opts.preferred) && enabled.includes(opts.preferred)) return opts.preferred;
  const al = (opts.acceptLanguage ?? "").toLowerCase();
  for (const part of al.split(",")) {
    const code = part.trim().slice(0, 2);
    if (isLang(code) && enabled.includes(code)) return code;
  }
  if (isLang(opts.fallback) && enabled.includes(opts.fallback)) return opts.fallback;
  return enabled[0] ?? "en";
}
