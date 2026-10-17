"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, claims, links, reward } from "@/db";
import { requireActiveBrand } from "@/lib/brand";
import { requireAdmin } from "@/lib/auth";

export type RewardFormState = { error?: string; saved?: boolean } | null;

const KINDS = ["code", "link", "manual"] as const;

async function ensureRow(brandId: string) {
  const db = await getDb();
  await db.insert(reward).values({ id: brandId }).onConflictDoNothing();
  return db;
}

export async function saveReward(_prev: RewardFormState, formData: FormData): Promise<RewardFormState> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { error: "Pick a reward type." };
  if (!title) return { error: "Enter a title." };
  if (title.length > 120 || description.length > 500 || value.length > 500) return { error: "That is too long." };
  if (kind === "link") {
    try {
      const u = new URL(value);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return { error: "Enter a full link, starting with https://" };
    }
  }
  const db = await ensureRow(active.id);
  await db.update(reward).set({ title, description, kind, value }).where(eq(reward.id, active.id));
  revalidatePath("/admin/rewards");
  return { saved: true };
}

export async function setRewardEnabled(next: boolean): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const db = await ensureRow(active.id);
  await db.update(reward).set({ enabled: next }).where(eq(reward.id, active.id));
  revalidatePath("/admin/rewards");
}

export async function setClaimStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "approved" && status !== "sent") return;
  const db = await getDb();
  const [claim] = await db.select({ id: claims.id }).from(claims)
    .innerJoin(links, eq(links.id, claims.linkId))
    .where(and(eq(claims.id, id), eq(links.brandId, active.id))).limit(1);
  if (!claim) return;
  await db.update(claims).set({ status }).where(eq(claims.id, id));
  revalidatePath("/admin/rewards");
}
