import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, links, portals, products, reward, submissions, visits } from "@/db";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { getActiveBrand } from "@/lib/brand";
import { canIncentivize } from "@/lib/compliance";
import { csvCell as cell } from "@/lib/csv";

const MAX_ROWS = 10_000;
const COUNTRY: Record<string, string> = { US: "United States", DE: "Germany", JP: "Japan" };
const STATUS: Record<string, string> = { submitted: "Submitted", pending: "Pending", published: "Published", rejected: "Rejected" };

/**
 * One row per posted review in the client's tracking-sheet layout (country, platform, request and submit dates, status).
 * No customer name or email: the sheet is shared with the client's team.
 */
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
  const [vs, subs, ps, pts, ls, [rw]] = await Promise.all([
    db.select().from(visits).where(and(eq(visits.brandId, b.id), isNotNull(visits.copiedAt))).orderBy(desc(visits.copiedAt)).limit(MAX_ROWS),
    db
      .select({
        visitId: submissions.visitId, createdAt: submissions.createdAt, trackStatus: submissions.trackStatus,
        publishedUrl: submissions.publishedUrl, screenshotUrl: submissions.screenshotUrl, trackNotes: submissions.trackNotes,
      })
      .from(submissions)
      .where(eq(submissions.brandId, b.id)),
    db.select({ id: products.id, name: products.name, url: products.url, market: products.market, priority: products.priority }).from(products).where(eq(products.brandId, b.id)),
    db.select().from(portals).where(eq(portals.brandId, b.id)),
    db.select({ id: links.id, kind: links.kind, customerName: links.customerName, createdAt: links.createdAt }).from(links).where(eq(links.brandId, b.id)),
    db.select().from(reward).where(eq(reward.id, b.id)).limit(1),
  ]);
  const latest = new Map<string, (typeof subs)[number]>();
  for (const x of subs) if ((latest.get(x.visitId)?.createdAt ?? -1) < x.createdAt) latest.set(x.visitId, x);
  const product = new Map(ps.map((p) => [p.id, p]));
  const portal = new Map(pts.map((p) => [p.id, p]));
  const link = new Map(ls.map((l) => [l.id, l]));
  const rewardOn = !!rw?.enabled && !b.strict;
  const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString().slice(0, 10) : "");

  const head = [
    "Country", "Platform", "Product / Business", "Product URL", "Priority", "Review source", "Review request date",
    "Review submitted date", "Reviewer language", "Incentive/sample disclosure required?", "Status", "Published review URL",
    "Screenshot", "Notes",
  ];
  const lines = [head.join(",")];
  for (const v of vs) {
    const p = product.get(v.productId);
    const po = v.portalId ? portal.get(v.portalId) : undefined;
    const l = link.get(v.linkId);
    const r = latest.get(v.id);
    // A personal link was a request on the day it was made; a shared product link (QR, email footer) asks on each visit.
    const requested = l?.kind === "customer" ? l.createdAt : v.createdAt;
    lines.push([
      (p?.market && COUNTRY[p.market]) || "",
      po?.label ?? "",
      p?.name ?? "Removed product",
      p?.url ?? "",
      p?.priority ? `P${p.priority}` : "",
      l?.kind === "customer" ? "Personal review link" : "Product link",
      iso(requested),
      iso(v.copiedAt),
      v.language,
      po && rewardOn && canIncentivize(po) ? "Yes" : "No",
      STATUS[r?.trackStatus ?? "submitted"],
      r?.publishedUrl ?? "",
      r?.screenshotUrl ?? "",
      r?.trackNotes ?? "",
    ].map(cell).join(","));
  }
  const day = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tracking-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
