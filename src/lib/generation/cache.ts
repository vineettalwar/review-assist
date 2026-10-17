import { and, desc, eq, count } from "drizzle-orm";
import { getDb, drafts, submissions } from "@/db";
import type { DraftLength } from "./types";

/** Drafts one visit may request (New draft, rating and chip changes). */
export const MAX_GENERATIONS_PER_VISIT = 15;

export const cacheKey = (ids: string[]) => JSON.stringify([...ids].sort());

type Key = { linkId: string; visitId: string; rating: number; keys: string; length: DraftLength; variant: number };

export async function findCached(k: Key) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.linkId, k.linkId),
        eq(drafts.visitId, k.visitId),
        eq(drafts.rating, k.rating),
        eq(drafts.highlightKeys, k.keys),
        eq(drafts.length, k.length),
        eq(drafts.variant, k.variant),
      ),
    )
    .limit(1);
  return row;
}

export async function countVisitDrafts(linkId: string, visitId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(drafts).where(and(eq(drafts.linkId, linkId), eq(drafts.visitId, visitId)));
  return r?.n ?? 0;
}

export async function findNearest(linkId: string, visitId: string, rating: number, length: DraftLength) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.linkId, linkId), eq(drafts.visitId, visitId), eq(drafts.rating, rating), eq(drafts.length, length)))
    .orderBy(desc(drafts.createdAt))
    .limit(1);
  return row;
}

/** Recent drafts and posted reviews for a product: what a new draft must not resemble. */
export async function recentTexts(productId: string): Promise<string[]> {
  const db = await getDb();
  const [d, s] = await Promise.all([
    db.select({ t: drafts.text }).from(drafts).where(eq(drafts.productId, productId)).orderBy(desc(drafts.createdAt)).limit(80),
    db.select({ t: submissions.finalText }).from(submissions).where(eq(submissions.productId, productId)).orderBy(desc(submissions.createdAt)).limit(40),
  ]);
  return [...s.map((r) => r.t), ...d.map((r) => r.t)];
}

export async function storeDraft(d: Key & { productId: string; text: string; model: string }) {
  const db = await getDb();
  await db
    .insert(drafts)
    .values({
      id: crypto.randomUUID(),
      linkId: d.linkId,
      visitId: d.visitId,
      productId: d.productId,
      rating: d.rating,
      highlightKeys: d.keys,
      length: d.length,
      variant: d.variant,
      text: d.text,
      model: d.model,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
}
