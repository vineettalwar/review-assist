import type { Brand, Example, Product, Settings } from "@/db";
import type { Lang } from "@/lib/i18n/languages";

export type DraftLength = "short" | "detailed";

export interface PromptHighlight {
  label: string;
  polarity: string;
  kind?: "point" | "situation";
}

export interface PromptLink {
  language: string;
  visitNotes: string;
  customerName?: string;
  /** What the customer typed on the review page themselves ("In your own words"). */
  customerWords?: string;
}

export interface PromptMemory {
  kind: "fact" | "style" | "avoid";
  text: string;
  scope: "brand" | "product";
}

export interface PromptInspiration {
  text: string;
  note: string;
}

export type PromptProduct = Pick<Product, "name" | "category" | "knowledge" | "avoid" | "audience" | "experience" | "praise" | "concerns">;

export interface PromptInput {
  memory?: PromptMemory[];
  /** Writing the business likes; tone and structure only. */
  inspirations?: PromptInspiration[];
  brand: Brand | undefined;
  product: PromptProduct;
  examples: Pick<Example, "rating" | "text">[];
  link: PromptLink;
  rating: number;
  highlights: PromptHighlight[];
  length: DraftLength;
  variant: number;
  /** Seeded writing plan that steers this draft away from others. */
  plan?: string;
  /** Openings already used for this product; the draft must not start the same way. */
  usedOpenings?: string[];
  /** Set when a previous attempt came out too close to an earlier review. */
  retryNote?: string;
}

export interface GenContext {
  memory: PromptMemory[];
  inspirations: PromptInspiration[];
  brand: Brand | undefined;
  settings: Settings | undefined;
  product: Product;
  highlights: PromptHighlight[];
  examples: Pick<Example, "rating" | "text">[];
  lang: Lang;
}
