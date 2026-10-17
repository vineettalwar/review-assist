import { REVIEW_LANGUAGES } from "@/lib/i18n/languages";

/** Review languages with full support (customer page, drafts). Enable them in Settings. */
export const LANGUAGES = REVIEW_LANGUAGES.map((l) => ({ value: l.code, label: l.label }));

export const VOICES = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "brief", label: "Brief" },
] as const;

export type Voice = (typeof VOICES)[number]["value"];
export type Polarity = "pos" | "neg" | "both";
