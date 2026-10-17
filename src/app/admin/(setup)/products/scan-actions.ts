"use server";

import { and, eq, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getActiveBrand } from "@/lib/brand";
import { getDb, products, highlights } from "@/db";
import { prefillFromUrls } from "@/lib/prefill";
import { addMemories } from "@/lib/memory";
import type { MemoryKind } from "@/lib/memory";
import { qs } from "../flash";

type Polarity = "pos" | "neg" | "both";

export type ScanProposal = {
  url: string;
  mode: "ai" | "basic";
  warnings: string[];
  category: string; // only set when the product has none
  knowledge: string[];
  audience: string[];
  experience: string[];
  praise: string[];
  concerns: string[];
  avoid: string[];
  highlights: { label: string; polarity: Polarity }[];
  memories: { kind: MemoryKind; text: string }[];
};
export type ScanResult = { ok: true; proposal: ScanProposal } | { ok: false; error: string };

const SCAN_SOURCE = "scan" as const;
const MAX_LABEL = 40;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Keeps only entries whose normalized text isn't in `have` (and not repeated within `items`). */
function fresh(items: string[], have: string[]): string[] {
  const seen = new Set(have.map(norm));
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t || seen.has(norm(t))) continue;
    seen.add(norm(t));
    out.push(t);
  }
  return out;
}

function cleanHighlights(list: { label: string; polarity: Polarity }[], have: string[]) {
  const seen = new Set(have.map(norm));
  const out: { label: string; polarity: Polarity }[] = [];
  for (const h of list) {
    const label = String(h?.label ?? "").trim().slice(0, MAX_LABEL);
    if (!label || seen.has(norm(label))) continue;
    seen.add(norm(label));
    out.push({ label, polarity: (["pos", "neg", "both"] as const).includes(h.polarity) ? h.polarity : "pos" });
  }
  return out;
}

function httpsUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

async function ownProduct(productId: string) {
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const db = await getDb();
  const [p] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.brandId, active.id)));
  if (!p) redirect("/admin/products" + qs({ error: "That product no longer exists." }));
  return { db, active, p };
}

export async function scanProductUrl(productId: string, url: string): Promise<ScanResult> {
  await requireAdmin();
  const { db, active, p } = await ownProduct(productId);
  if (!httpsUrl(url)) return { ok: false, error: "Enter a full https:// address." };
  let r;
  try {
    r = await prefillFromUrls({ productUrls: [url.trim()], brandName: active.name });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't scan that page." };
  }
  if (!r.sources.length) {
    return { ok: false, error: r.warnings.join(" ") || "Couldn't read that page." };
  }
  const found = r.products[0];
  const hs = await db.select({ label: highlights.label }).from(highlights).where(eq(highlights.productId, p.id));
  const proposal: ScanProposal = {
    url: r.sources[0],
    mode: r.mode,
    warnings: r.warnings,
    category: p.category.trim() ? "" : (found?.category ?? "").trim().slice(0, 80),
    knowledge: fresh(lines(found?.knowledge ?? ""), lines(p.knowledge)),
    audience: fresh(lines(found?.audience ?? ""), lines(p.audience)),
    experience: fresh(lines(found?.experience ?? ""), lines(p.experience)),
    praise: fresh(lines(found?.praise ?? ""), lines(p.praise)),
    concerns: fresh(lines(found?.concerns ?? ""), lines(p.concerns)),
    avoid: fresh(lines(found?.avoid ?? ""), lines(p.avoid)),
    highlights: cleanHighlights(found?.highlights ?? [], hs.map((h) => h.label)),
    memories: r.memories
      .filter((m) => m.productIndex === 0 || m.productIndex === null)
      .map((m) => ({ kind: m.kind, text: m.text.trim() }))
      .filter((m) => m.text),
  };
  return { ok: true, proposal };
}

export async function applyProductScan(
  productId: string,
  payload: Pick<ScanProposal, "url" | "category" | "knowledge" | "audience" | "experience" | "praise" | "concerns" | "avoid" | "highlights" | "memories">,
) {
  await requireAdmin();
  const { db, active, p } = await ownProduct(productId);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(str) : []);

  // Re-dedupe against what's saved now; the page may have been edited since the scan.
  const knowledge = fresh(strs(payload.knowledge), lines(p.knowledge));
  const avoid = fresh(strs(payload.avoid), lines(p.avoid));
  const rawHs = (Array.isArray(payload.highlights) ? payload.highlights : []).map((h) => ({ label: str(h?.label), polarity: h?.polarity }));
  const existing = await db.select().from(highlights).where(eq(highlights.productId, p.id)).orderBy(asc(highlights.sort));
  const newHs = cleanHighlights(rawHs, existing.map((h) => h.label));

  const set: Partial<typeof products.$inferInsert> = { updatedAt: Date.now() };
  if (knowledge.length) set.knowledge = [p.knowledge.trim(), ...knowledge].filter(Boolean).join("\n");
  if (avoid.length) set.avoid = [p.avoid.trim(), ...avoid].filter(Boolean).join("\n");
  for (const k of ["audience", "experience", "praise", "concerns"] as const) {
    const add = fresh(strs(payload[k]), lines(p[k]));
    if (add.length) set[k] = [p[k].trim(), ...add].filter(Boolean).join("\n").slice(0, 6000);
  }
  if (!p.url.trim()) {
    const u = httpsUrl(str(payload.url));
    if (u) set.url = u;
  }
  const cat = str(payload.category).trim().slice(0, 80);
  if (!p.category.trim() && cat) set.category = cat;
  await db.update(products).set(set).where(and(eq(products.id, p.id), eq(products.brandId, active.id)));

  const sort = existing.reduce((m, h) => Math.max(m, h.sort), -1) + 1;
  await insertHighlights(db, p.id, newHs, sort);

  const kinds: MemoryKind[] = ["fact", "style", "avoid"];
  const mems = (Array.isArray(payload.memories) ? payload.memories : [])
    .filter((m) => kinds.includes(m?.kind) && str(m?.text).trim())
    .slice(0, 20)
    .map((m) => ({ brandId: active.id, productId: p.id, kind: m.kind, text: str(m.text), source: SCAN_SOURCE, status: "proposed" as const, evidence: str(payload.url) }));
  await addMemories(mems);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${p.id}`);
  revalidatePath("/admin/training");
  redirect(`/admin/products/${p.id}` + qs({ saved: "1" }));
}

/** One batched round trip; single-row inserts keep each statement under D1's bound-parameter cap. */
async function insertHighlights(db: Awaited<ReturnType<typeof getDb>>, productId: string, hs: { label: string; polarity: Polarity }[], from: number) {
  if (!hs.length) return;
  const stmts = hs.map((h, i) => db.insert(highlights).values({ id: crypto.randomUUID(), productId, label: h.label, polarity: h.polarity, sort: from + i }));
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
}

/** Last path segment or hostname, as a readable fallback product name. */
function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).pop();
    const host = u.hostname.replace(/^www\./, "");
    if (!tail) return host;
    return `${host} ${decodeURIComponent(tail).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_+]+/g, " ")}`.trim();
  } catch {
    return "New product";
  }
}

export async function createProductFromUrl(formData: FormData) {
  await requireAdmin();
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const back = String(formData.get("back") ?? "") === "list" ? "/admin/products" : "/admin/products/new";
  const raw = String(formData.get("url") ?? "").trim();
  if (!httpsUrl(raw)) redirect(back + qs({ error: "Enter a full https:// address." }));

  let r;
  try {
    r = await prefillFromUrls({ productUrls: [raw], brandName: active.name });
  } catch (e) {
    redirect(back + qs({ error: e instanceof Error ? e.message : "Couldn't scan that page." }));
  }
  if (!r.sources.length) {
    redirect(back + qs({ error: r.warnings.join(" ") || "Couldn't read that page, so nothing was created." }));
  }

  const found = r.products[0];
  const url = r.sources[0];
  const db = await getDb();
  const now = Date.now();
  const pid = crypto.randomUUID();
  await db.insert(products).values({
    id: pid,
    brandId: active.id,
    name: (found?.name ?? "").trim().slice(0, 120) || nameFromUrl(url),
    category: (found?.category ?? "").trim().slice(0, 80),
    knowledge: fresh(lines(found?.knowledge ?? ""), []).join("\n"),
    avoid: fresh(lines(found?.avoid ?? ""), []).join("\n"),
    audience: fresh(lines(found?.audience ?? ""), []).join("\n"),
    experience: fresh(lines(found?.experience ?? ""), []).join("\n"),
    praise: fresh(lines(found?.praise ?? ""), []).join("\n"),
    concerns: fresh(lines(found?.concerns ?? ""), []).join("\n"),
    url: url.slice(0, 500),
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  const hs = cleanHighlights(found?.highlights ?? [], []);
  await insertHighlights(db, pid, hs, 0);
  await addMemories(
    r.memories
      .filter((m) => (m.productIndex === 0 || m.productIndex === null) && m.text.trim())
      .slice(0, 20)
      .map((m) => ({ brandId: active.id, productId: pid, kind: m.kind, text: m.text, source: SCAN_SOURCE, status: "proposed" as const, evidence: url })),
  );

  revalidatePath("/admin/products");
  revalidatePath("/admin/training");
  redirect(`/admin/products/${pid}` + qs({ saved: "1" }));
}
