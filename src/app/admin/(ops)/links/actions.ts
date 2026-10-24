"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, claims, links, submissions } from "@/db";
import { requireActiveBrand } from "@/lib/brand";
import { requireAdmin } from "@/lib/auth";

export async function setLinkDisabled(formData: FormData): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const disable = formData.get("disable") === "1";
  const db = await getDb();
  const [link] = await db.select().from(links).where(and(eq(links.id, id), eq(links.brandId, active.id))).limit(1);
  if (!link) return;
  let status: typeof link.status = "disabled";
  if (!disable) {
    const [claim] = await db.select().from(claims).where(eq(claims.linkId, id)).limit(1);
    status = link.kind === "product" ? (link.openedAt ? "opened" : "created") : claim ? "claimed" : link.copiedAt ? "copied" : link.openedAt ? "opened" : "created";
  }
  await db.update(links).set({ status }).where(and(eq(links.id, id), eq(links.brandId, active.id)));
  revalidatePath("/admin/links");
  revalidatePath("/admin/products", "layout");
}

const TRACK = ["submitted", "pending", "published", "rejected"] as const;

/** Tracking after the customer posted: what the admin found on the portal. */
export async function setTracking(formData: FormData): Promise<void> {
  await requireAdmin();
  const active = await requireActiveBrand();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const url = (k: string) => {
    const v = String(formData.get(k) ?? "").trim().slice(0, 500);
    return /^https:\/\//i.test(v) ? v : "";
  };
  const db = await getDb();
  await db
    .update(submissions)
    .set({
      trackStatus: (TRACK as readonly string[]).includes(status) ? (status as (typeof TRACK)[number]) : "submitted",
      publishedUrl: url("publishedUrl"),
      screenshotUrl: url("screenshotUrl"),
      trackNotes: String(formData.get("notes") ?? "").trim().slice(0, 1000),
    })
    .where(and(eq(submissions.id, id), eq(submissions.brandId, active.id)));
  revalidatePath("/admin/links");
}
