import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb, brand, settings, products, highlights, examples, memories } from "@/db";
import type { Lang } from "@/lib/i18n/languages";
import type { GenContext } from "./types";

/** Everything the model may know for one draft. One round of parallel queries after the product lookup. */
export async function loadContext(productId: string, rating: number, highlightIds: string[], lang: Lang = "en"): Promise<GenContext> {
  const db = await getDb();
  const [[product], [s], hl] = await Promise.all([
    db.select().from(products).where(eq(products.id, productId)).limit(1),
    db.select().from(settings).where(eq(settings.id, "default")).limit(1),
    highlightIds.length
      ? db.select().from(highlights).where(and(eq(highlights.productId, productId), inArray(highlights.id, highlightIds)))
      : Promise.resolve([]),
  ]);
  if (!product) throw new Error("Product not found");

  const [[b], all, mem] = await Promise.all([
    db.select().from(brand).where(eq(brand.id, product.brandId)).limit(1),
    db
      .select()
      .from(examples)
      .where(and(eq(examples.brandId, product.brandId), or(eq(examples.productId, productId), isNull(examples.productId)))),
    db
      .select({ kind: memories.kind, text: memories.text, productId: memories.productId })
      .from(memories)
      .where(
        and(
          eq(memories.brandId, product.brandId),
          eq(memories.status, "active"),
          or(eq(memories.productId, productId), isNull(memories.productId)),
        ),
      ),
  ]);

  const order = new Map(highlightIds.map((id, i) => [id, i]));
  hl.sort((a, c) => (order.get(a.id) ?? 0) - (order.get(c.id) ?? 0));

  const score = (e: (typeof all)[number]) => {
    const near = rating === 0 ? 0 : Math.abs(e.rating - rating) <= 1 ? 0 : 1;
    const same = e.productId === productId ? 0 : 1;
    return near * 2 + same;
  };
  const picked = all
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => rating === 0 || x.s < 2 || all.length <= 4)
    .sort((x, y) => x.s - y.s || y.e.createdAt - x.e.createdAt)
    .slice(0, 4)
    .map((x) => ({ rating: x.e.rating, text: x.e.text }));

  // Product memory first, capped to keep prompts tight.
  mem.sort((x, y) => (x.productId ? 0 : 1) - (y.productId ? 0 : 1));

  return {
    memory: mem.slice(0, 24).map((m) => ({ kind: m.kind, text: m.text, scope: m.productId ? ("product" as const) : ("brand" as const) })),
    brand: b,
    settings: s,
    product,
    highlights: hl.map((h) => ({ label: lang === "ja" && h.labelJa ? h.labelJa : h.label, polarity: h.polarity })),
    examples: picked,
    lang,
  };
}

const lines = (s: string | undefined) => (s ?? "").split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** Context lines a draft can lean on; the plan picks one per draft so customers don't all write about the same thing. */
export function focusPool(ctx: Pick<GenContext, "product" | "memory">): string[] {
  const p = ctx.product;
  return [
    ...lines(p.experience),
    ...lines(p.praise),
    ...lines(p.knowledge).slice(0, 12),
    ...ctx.memory.filter((m) => m.kind === "fact" && m.scope === "product").map((m) => m.text),
  ].filter((l) => l.length >= 8 && l.length <= 220);
}
