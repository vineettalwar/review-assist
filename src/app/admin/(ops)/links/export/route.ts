import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, portals, products, submissions, visits } from "@/db";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { getActiveBrand } from "@/lib/brand";

const MAX_ROWS = 10_000;

// Leading = + - @ make spreadsheets run the cell as a formula; a quote in front keeps it plain text.
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every customer response for the active brand as CSV: who, what they posted, where and when. */
export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new Response("Unauthorized", { status: 401 });
    throw e;
  }
  const b = await getActiveBrand();
  if (!b) return new Response("No brand", { status: 404 });
  const db = await getDb();
  const [vs, subs, ps, pts] = await Promise.all([
    db.select().from(visits).where(and(eq(visits.brandId, b.id), isNotNull(visits.copiedAt))).orderBy(desc(visits.copiedAt)).limit(MAX_ROWS),
    db.select({ visitId: submissions.visitId, finalText: submissions.finalText, draftText: submissions.draftText, edited: submissions.edited, createdAt: submissions.createdAt }).from(submissions).where(eq(submissions.brandId, b.id)),
    db.select({ id: products.id, name: products.name }).from(products).where(eq(products.brandId, b.id)),
    db.select({ id: portals.id, label: portals.label }).from(portals).where(eq(portals.brandId, b.id)),
  ]);
  const latest = new Map<string, (typeof subs)[number]>();
  for (const x of subs) if ((latest.get(x.visitId)?.createdAt ?? -1) < x.createdAt) latest.set(x.visitId, x);
  const pname = new Map(ps.map((p) => [p.id, p.name]));
  const plabel = new Map(pts.map((p) => [p.id, p.label]));

  const head = ["Submitted at", "Name", "Email", "Product", "Language", "Rating", "Posted to", "Review", "Edited", "Original draft"];
  const lines = [head.join(",")];
  for (const v of vs) {
    const r = latest.get(v.id);
    lines.push([
      new Date(v.copiedAt ?? v.createdAt).toISOString(),
      v.name, v.email, pname.get(v.productId) ?? "Removed product", v.language,
      v.rating || "", (v.portalId && plabel.get(v.portalId)) || "",
      r?.finalText ?? "", r ? (r.edited ? "yes" : "no") : "", r?.draftText ?? "",
    ].map(cell).join(","));
  }
  const day = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens Japanese text as UTF-8.
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="responses-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
