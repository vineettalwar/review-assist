"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, portals } from "@/db";
import type { Portal } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { requireActiveBrand } from "@/lib/brand";
import { normalizePortal } from "@/lib/compliance";
import { toGoogleReviewUrl } from "@/lib/portals/google";

export type PortalFormState = { error?: string; ok?: boolean } | null;

const TYPES: Portal["type"][] = ["google", "trustpilot", "amazon", "yelp", "facebook", "g2", "custom"];

function bump() {
  revalidatePath("/admin/portals");
  revalidatePath("/admin/rewards");
}

export async function savePortal(_prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "") as Portal["type"];
  const label = String(formData.get("label") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (!TYPES.includes(type)) return { error: "Pick a portal type." };
  if (!label) return { error: "Enter a label." };
  if (label.length > 60) return { error: "Label must be 60 characters or fewer." };
  if (url.length > 500) return { error: "That URL is too long." };
  if (type === "google") {
    const g = toGoogleReviewUrl(url);
    if ("error" in g) return { error: g.error };
    url = g.url;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Enter a full URL, starting with https://" };
  }
  if (parsed.protocol !== "https:") return { error: "The URL must start with https://" };

  const db = await getDb();
  // normalizePortal forces allowsIncentives=false for locked types, regardless of what was submitted.
  const base = normalizePortal({ type, label, url, allowsIncentives: formData.get("allowsIncentives") === "on" });

  if (id) {
    const [existing] = await db.select().from(portals).where(and(eq(portals.id, id), eq(portals.brandId, active.id))).limit(1);
    if (!existing) return { error: "That portal no longer exists." };
    await db.update(portals).set(base).where(and(eq(portals.id, id), eq(portals.brandId, active.id)));
  } else {
    const all = await db.select({ sort: portals.sort }).from(portals).where(eq(portals.brandId, active.id));
    if (all.length >= 50) return { error: "A brand can have at most 50 portals." };
    await db.insert(portals).values({
      id: crypto.randomUUID(), brandId: active.id, ...base,
      isDefault: all.length === 0,
      sort: all.reduce((m, p) => Math.max(m, p.sort), -1) + 1,
    });
  }
  bump();
  return { ok: true };
}

export async function setPortalDefault(id: string, next: boolean): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const db = await getDb();
  await db.update(portals).set({ isDefault: next }).where(and(eq(portals.id, id), eq(portals.brandId, active.id)));
  bump();
}

export async function setPortalIncentives(id: string, next: boolean): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const db = await getDb();
  const [p] = await db.select().from(portals).where(and(eq(portals.id, id), eq(portals.brandId, active.id))).limit(1);
  if (!p) return;
  const n = normalizePortal({ type: p.type, allowsIncentives: next });
  await db.update(portals).set({ allowsIncentives: n.allowsIncentives }).where(and(eq(portals.id, id), eq(portals.brandId, active.id)));
  bump();
}

export async function movePortal(formData: FormData): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const db = await getDb();
  const all = (await db.select().from(portals).where(eq(portals.brandId, active.id))).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  const i = all.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  // renumber to keep sorts distinct, in one D1 round trip
  const updates = all
    .map((p, k) => ({ p, k }))
    .filter(({ p, k }) => p.sort !== k)
    .map(({ p, k }) => db.update(portals).set({ sort: k }).where(and(eq(portals.id, p.id), eq(portals.brandId, active.id))));
  if (updates.length) await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
  bump();
}

export async function deletePortal(formData: FormData): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const db = await getDb();
  await db.delete(portals).where(and(eq(portals.id, id), eq(portals.brandId, active.id)));
  bump();
}
