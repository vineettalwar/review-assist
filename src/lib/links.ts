// One permanent review link per product. Created on demand; never reissued, so a printed QR code keeps working.
import { and, eq, inArray } from "drizzle-orm";
import { getDb, links, products } from "@/db";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 10 chars over [a-z0-9] using rejection sampling (no modulo bias). ~51 bits. */
export function makeToken(): string {
  let out = "";
  while (out.length < 10) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) if (b < 252 && out.length < 10) out += ALPHABET[b % 36];
  }
  return out;
}

/** Makes sure every product of the brand has its product link. Returns productId -> link. */
export async function ensureProductLinks(brandId: string) {
  const db = await getDb();
  const [ps, ls] = await Promise.all([
    db.select({ id: products.id }).from(products).where(eq(products.brandId, brandId)),
    db.select().from(links).where(and(eq(links.brandId, brandId), eq(links.kind, "product"))),
  ]);
  const have = new Map(ls.map((l) => [l.productId, l]));
  const missing = ps.filter((p) => !have.has(p.id));
  if (missing.length) {
    const now = Date.now();
    const rows = missing.map((p) => ({
      id: crypto.randomUUID(), brandId, token: makeToken(), productId: p.id, kind: "product" as const,
      customerName: "", language: "", visitNotes: "", status: "created" as const, createdAt: now,
    }));
    // Token collisions are astronomically unlikely; a failed batch simply retries on the next page load.
    await db.insert(links).values(rows).onConflictDoNothing();
    const fresh = await db.select().from(links).where(and(eq(links.brandId, brandId), eq(links.kind, "product"), inArray(links.productId, missing.map((m) => m.id))));
    for (const l of fresh) if (!have.has(l.productId)) have.set(l.productId, l);
  }
  return have;
}
