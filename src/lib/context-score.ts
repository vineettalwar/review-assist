// How well the AI knows a product or the brand. Shared by the product page and the Brain page.
import type { Brand, Highlight, Product } from "@/db";

const count = (s: string | null | undefined) => (s ?? "").split(/\r?\n/).filter((l) => l.trim()).length;

export type Check = { label: string; ok: boolean };

export function productChecks(p: Product, hs: Pick<Highlight, "polarity" | "labelJa">[], ja: boolean): Check[] {
  return [
    { label: "3+ facts", ok: count(p.knowledge) >= 3 },
    { label: "Who it's for", ok: count(p.audience) >= 1 },
    { label: "2+ journey steps", ok: count(p.experience) >= 2 },
    { label: "2+ things customers praise", ok: count(p.praise) >= 2 },
    { label: "1+ thing customers raise", ok: count(p.concerns) >= 1 },
    { label: "5+ highlight chips", ok: hs.length >= 5 },
    { label: "2+ negative or both chips", ok: hs.filter((h) => h.polarity !== "pos").length >= 2 },
    ...(ja ? [{ label: "Japanese chip labels", ok: hs.length > 0 && hs.every((h) => h.labelJa.trim()) }] : []),
  ];
}

export function brandChecks(b: Brand): Check[] {
  return [
    { label: "About", ok: b.about.trim().length >= 20 },
    { label: "Customers", ok: b.audience.trim().length > 0 },
    { label: "3+ brand facts", ok: count(b.facts) >= 3 },
    { label: "Voice notes", ok: b.voiceNotes.trim().length > 0 },
  ];
}

/** Distinct context lines a draft can lean on (matches generation's focus pool, minus memory). */
export const angleCount = (p: Product) => count(p.experience) + count(p.praise) + Math.min(12, count(p.knowledge));
