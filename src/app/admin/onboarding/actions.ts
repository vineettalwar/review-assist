"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, brand, products, highlights, portals, reward, examples } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { setActiveBrandCookie } from "@/lib/brand";
import { normalizePortal } from "@/lib/compliance";
import { toGoogleReviewUrl } from "@/lib/portals/google";
import { importSite, type ImportResult } from "@/lib/prefill/discover";
import { addMemories } from "@/lib/memory";
import { previewDraft } from "@/lib/generation";
import type { MemKind, Polarity, PortalType, SavePayload, SavedProduct, Voice } from "./types";

type Err = { ok: false; error: string };

const MAX_PRODUCTS = 50;
const MAX_HIGHLIGHTS = 20;
const MAX_PORTALS = 20;
const VOICES: Voice[] = ["warm", "professional", "casual", "brief"];
const POLARITIES: Polarity[] = ["pos", "neg", "both"];
const PORTAL_TYPES: PortalType[] = ["google", "trustpilot", "amazon", "yelp", "facebook", "g2", "custom"];
const MEM_KINDS: MemKind[] = ["fact", "style", "avoid"];

/** Server actions receive whatever the client sends: coerce, trim and cap. */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function isHttps(u: string) {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** One-click import: find the site's service and about pages, read up to `pages` of them, and draft the whole setup. Nothing is saved. */
export async function importAction(args: { website: string; pages: number; extraUrls: string[] }): Promise<{ ok: true; result: ImportResult } | Err> {
  await requireAdmin();
  const website = str(args?.website, 500);
  if (!isHttps(website)) return { ok: false, error: "Enter the website as a full https:// address." };
  const extra = (Array.isArray(args?.extraUrls) ? args.extraUrls : []).map((u) => str(u, 500)).filter(Boolean).slice(0, 10);
  if (extra.some((u) => !isHttps(u))) return { ok: false, error: "Specific pages must be full https:// addresses." };
  const pages = Math.max(2, Math.min(30, Math.round(Number(args?.pages) || 8)));
  try {
    return { ok: true, result: await importSite(website, { pages, extraUrls: extra }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : "Couldn't read the site. You can fill in by hand." };
  }
}

async function loadSaved(brandId: string): Promise<SavedProduct[]> {
  const db = await getDb();
  const ps = await db.select().from(products).where(eq(products.brandId, brandId)).orderBy(asc(products.createdAt), asc(products.name));
  if (!ps.length) return [];
  // One query for all highlights instead of one per product.
  const hs = await db
    .select({ id: highlights.id, productId: highlights.productId, label: highlights.label, polarity: highlights.polarity })
    .from(highlights)
    .innerJoin(products, eq(products.id, highlights.productId))
    .where(eq(products.brandId, brandId))
    .orderBy(asc(highlights.sort));
  const byProduct = new Map<string, { id: string; label: string; polarity: Polarity }[]>();
  for (const h of hs) byProduct.set(h.productId, [...(byProduct.get(h.productId) ?? []), { id: h.id, label: h.label, polarity: h.polarity }]);
  return ps.map((p) => ({ key: p.id, id: p.id, name: p.name, highlights: byProduct.get(p.id) ?? [] }));
}

export async function createBrandFromOnboarding(
  input: SavePayload,
): Promise<{ ok: true; brandId: string; products: SavedProduct[]; warning?: string } | { ok: false; error: string; field?: string }> {
  await requireAdmin();
  const db = await getDb();

  // Idempotent: a repeat call for a brand that already exists returns it unchanged.
  if (input.brandId) {
    const [ex] = await db.select({ id: brand.id }).from(brand).where(eq(brand.id, String(input.brandId))).limit(1);
    if (ex) {
      await setActiveBrandCookie(ex.id);
      return { ok: true, brandId: ex.id, products: await loadSaved(ex.id) };
    }
  }

  const b = input?.brand;
  if (!b || !Array.isArray(input.products) || !Array.isArray(input.portals) || !Array.isArray(input.brandMemories)) {
    return { ok: false, error: "Something is missing. Reload and try again." };
  }
  const name = str(b.name, 120);
  if (!name) return { ok: false, error: "Brand name is required.", field: "brand" };
  const website = str(b.website, 300);
  if (website && !isHttps(website)) return { ok: false, error: "Website must be an https:// address.", field: "brand" };
  const prods = input.products.filter((p) => str(p?.name, 120)).slice(0, MAX_PRODUCTS);
  if (!prods.length) return { ok: false, error: "Add at least one product with a name.", field: "products" };
  for (const p of prods) {
    if (str(p.url, 500) && !isHttps(str(p.url, 500))) return { ok: false, error: `Product link for "${str(p.name, 120)}" must be https://.`, field: "products" };
  }
  const inPortals = input.portals.slice(0, MAX_PORTALS);
  const portalUrls: string[] = [];
  for (const p of inPortals) {
    if (!PORTAL_TYPES.includes(p?.type)) return { ok: false, error: "Pick a portal type.", field: "portals" };
    let url = str(p.url, 500);
    if (p.type === "google") {
      const g = toGoogleReviewUrl(url);
      if ("error" in g) return { ok: false, error: `Google: ${g.error}`, field: "portals" };
      url = g.url;
    }
    if (!isHttps(url)) return { ok: false, error: `Portal "${str(p.label, 60) || p.type}" needs an https:// link.`, field: "portals" };
    portalUrls.push(url);
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  const idByKey = new Map<string, string>();
  const productRows: (typeof products.$inferInsert)[] = [];
  const highlightRows: (typeof highlights.$inferInsert)[] = [];
  prods.forEach((p, pi) => {
    const pid = crypto.randomUUID();
    idByKey.set(String(p.key), pid);
    productRows.push({
      id: pid,
      brandId: id,
      name: str(p.name, 120),
      category: str(p.category, 80),
      url: str(p.url, 500),
      knowledge: str(p.knowledge, 10_000),
      avoid: str(p.avoid, 5_000),
      audience: str(p.audience, 2_000),
      experience: str(p.experience, 4_000),
      praise: str(p.praise, 4_000),
      concerns: str(p.concerns, 4_000),
      active: true,
      createdAt: now + pi,
      updatedAt: now,
    });
    let si = 0;
    for (const h of (Array.isArray(p.highlights) ? p.highlights : []).slice(0, MAX_HIGHLIGHTS)) {
      const label = str(h?.label, 60);
      if (!label) continue;
      highlightRows.push({ id: crypto.randomUUID(), productId: pid, label, polarity: POLARITIES.includes(h.polarity) ? h.polarity : "pos", sort: si++ });
    }
  });
  const portalRows = inPortals.map((p, sort) =>
    normalizePortal({
      id: crypto.randomUUID(),
      brandId: id,
      type: p.type,
      label: str(p.label, 60) || p.type,
      url: portalUrls[sort],
      allowsIncentives: false,
      isDefault: true, // every portal chosen in onboarding is offered to customers; order decides the main button
      sort,
    }),
  );

  // One D1 batch (one round trip, atomic) instead of an insert per product/highlight/portal.
  await db.batch([
    db.insert(brand).values({
      id,
      name,
      about: str(b.about, 2_000),
      audience: str(b.audience, 2_000),
      facts: str(b.facts, 4_000),
      voice: VOICES.includes(b.voice) ? b.voice : "warm",
      voiceNotes: str(b.voiceNotes, 2_000),
      wordsToAvoid: str(b.wordsToAvoid, 2_000),
      defaultLanguage: /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(String(b.defaultLanguage ?? "")) ? b.defaultLanguage : "en",
      website,
      createdAt: now,
      updatedAt: now,
    }),
    ...productRows.map((r) => db.insert(products).values(r)),
    ...highlightRows.map((r) => db.insert(highlights).values(r)),
    ...portalRows.map((r) => db.insert(portals).values(r)),
    db.insert(reward).values({ id, enabled: false }),
  ]);

  let warning: string | undefined;
  try {
    const mems = [
      ...input.brandMemories.map((m) => ({ ...m, productId: null as string | null })),
      ...prods.flatMap((p) => (Array.isArray(p.memories) ? p.memories : []).map((m) => ({ ...m, productId: idByKey.get(String(p.key)) ?? null }))),
    ]
      .map((m) => ({ ...m, text: str(m?.text, 200) }))
      .filter((m) => m.text && MEM_KINDS.includes(m.kind))
      .slice(0, 60);
    if (mems.length) {
      // Onboarding → proposed until the admin approves on Brain (memory rules).
      await addMemories(mems.map((m) => ({ brandId: id, productId: m.productId, kind: m.kind, text: m.text, source: "onboarding" as const })));
    }
  } catch {
    warning = "Brand saved, but the remembered notes couldn't be stored. Add them later under Memory.";
  }

  await setActiveBrandCookie(id);
  revalidatePath("/admin", "layout");
  return { ok: true, brandId: id, products: await loadSaved(id), warning };
}

export async function sampleAction(args: {
  brandId: string;
  productId: string;
  rating: number;
  highlightIds: string[];
  length: "short" | "detailed";
  variant: number;
}): Promise<{ ok: true; text: string; model: string } | Err> {
  await requireAdmin();
  const db = await getDb();
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, String(args.productId)), eq(products.brandId, String(args.brandId)))).limit(1);
  if (!p) return { ok: false, error: "That product isn't part of this brand." };
  try {
    const r = await previewDraft({
      productId: p.id,
      rating: Math.min(5, Math.max(0, Math.round(Number(args.rating) || 0))),
      highlightIds: (Array.isArray(args.highlightIds) ? args.highlightIds : []).filter((x) => typeof x === "string" && x.length <= 64).slice(0, 10).sort(),
      length: args.length === "detailed" ? "detailed" : "short",
      notes: "",
      variant: Math.min(50, Math.max(0, Math.round(Number(args.variant) || 0))),
    });
    return { ok: true, text: r.text, model: r.model };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't generate a sample." };
  }
}

export async function saveExampleAction(args: { brandId: string; productId: string; rating: number; text: string }): Promise<{ ok: true } | Err> {
  await requireAdmin();
  const text = str(args?.text, 5000);
  if (!text) return { ok: false, error: "Nothing to save." };
  const rating = Math.round(Number(args.rating) || 0);
  if (rating < 1 || rating > 5) return { ok: false, error: "Pick a star rating first." };
  const db = await getDb();
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, String(args.productId)), eq(products.brandId, String(args.brandId)))).limit(1);
  if (!p) return { ok: false, error: "That product isn't part of this brand." };
  await db.insert(examples).values({ id: crypto.randomUUID(), brandId: String(args.brandId), productId: p.id, rating, text, source: "playground", createdAt: Date.now() });
  return { ok: true };
}
