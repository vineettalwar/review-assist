import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, links, products, highlights, portals, productPortals, reward, brand, visits } from "@/db";

/** Portals a link may post to: product overrides, else default portals, ordered by sort. */
export async function resolvePortals(productId: string, brandId: string) {
  const db = await getDb();
  const overrides = await db.select({ id: productPortals.portalId }).from(productPortals).where(eq(productPortals.productId, productId));
  if (overrides.length) {
    const rows = await db
      .select()
      .from(portals)
      .where(
        and(
          eq(portals.brandId, brandId),
          inArray(
            portals.id,
            overrides.map((o) => o.id),
          ),
        ),
      )
      .orderBy(asc(portals.sort));
    if (rows.length) return rows;
  }
  return db.select().from(portals).where(and(eq(portals.brandId, brandId), eq(portals.isDefault, true))).orderBy(asc(portals.sort));
}

export async function getLinkByToken(token: string) {
  const db = await getDb();
  const [link] = await db.select().from(links).where(eq(links.token, token)).limit(1);
  return link ?? null;
}

export async function loadReviewData(token: string) {
  const link = await getLinkByToken(token);
  if (!link || link.status === "disabled") return null;
  const db = await getDb();
  const [[b], [product], hl, ps, [rw]] = await Promise.all([
    db.select().from(brand).where(eq(brand.id, link.brandId)).limit(1),
    db.select().from(products).where(eq(products.id, link.productId)).limit(1),
    db.select().from(highlights).where(eq(highlights.productId, link.productId)).orderBy(asc(highlights.sort)),
    resolvePortals(link.productId, link.brandId),
    db.select().from(reward).where(eq(reward.id, link.brandId)).limit(1),
  ]);
  return { link, brand: b ?? null, product: product ?? null, highlights: hl, portals: ps, reward: rw ?? null };
}

export async function markOpened(linkId: string) {
  const db = await getDb();
  await db
    .update(links)
    .set({ status: "opened", openedAt: Date.now() })
    .where(and(eq(links.id, linkId), eq(links.status, "created")));
}

/** Records a page load as a visit (no name or email yet; those arrive with the copy). */
export async function recordVisit(v: { id: string; linkId: string; brandId: string; productId: string; language: string }) {
  const db = await getDb();
  await db.insert(visits).values({ ...v, createdAt: Date.now() }).onConflictDoNothing();
}
