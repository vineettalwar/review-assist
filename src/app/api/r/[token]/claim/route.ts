import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, links, portals, claims, visits } from "@/db";
import { assertClaimAllowed } from "@/lib/compliance";
import { getLinkByToken } from "@/app/r/resolve";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { readVisit } from "@/lib/visit";

const MAX_BODY = 10 * 1024;
const HOUR = 60 * 60 * 1000;
// local@domain.tld: no spaces/quotes/angle brackets, dot-separated labels, TLD of 2+ letters.
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

function validEmail(email: string) {
  if (email.length > 254 || !EMAIL.test(email)) return false;
  const local = email.slice(0, email.lastIndexOf("@"));
  return !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

const tooMany = (ms: number) =>
  NextResponse.json(
    { error: "Too many attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(ms / 1000))) } },
  );

/** Reads at most MAX_BODY bytes; returns null when the body is larger or not JSON. */
async function readJson(req: Request): Promise<Record<string, unknown> | null | "too_large"> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return "too_large";
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BODY) {
      void reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  try {
    const v = JSON.parse(new TextDecoder().decode(buf));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length > 64) return NextResponse.json({ error: "Link not active." }, { status: 404 });

  const ipLimit = await rateLimit(`claim:ip:${clientIp(req.headers)}`, 10, HOUR);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfterMs);

  const body = await readJson(req);
  if (body === "too_large") return NextResponse.json({ error: "Request too large." }, { status: 413 });
  // Uses `email` and `visit`; any other fields are ignored.
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const link = await getLinkByToken(token);
  if (!link || link.status === "disabled") return NextResponse.json({ error: "Link not active." }, { status: 404 });
  const isProductLink = link.kind === "product";
  const linkLimit = await rateLimit(`claim:link:${link.id}`, isProductLink ? 200 : 5, HOUR);
  if (!linkLimit.ok) return tooMany(linkLimit.retryAfterMs);

  // `visit` is required: a signed token bound to this link (see src/lib/visit.ts).
  if (typeof body?.visit !== "string" || !body.visit) {
    return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });
  }
  const v = await readVisit(link.id, body.visit);
  if (!v) return NextResponse.json({ error: "This page has expired. Reload it and try again." }, { status: 410 });

  const db = await getDb();
  const [visit] = await db
    .select({ id: visits.id, linkId: visits.linkId, portalId: visits.portalId, copiedAt: visits.copiedAt })
    .from(visits)
    .where(and(eq(visits.id, v.visitId), eq(visits.linkId, link.id)))
    .limit(1);
  if (!visit?.portalId || !visit.copiedAt) {
    return NextResponse.json({ error: "Copy your review first to claim the reward." }, { status: 400 });
  }
  const [portal] = await db.select().from(portals).where(eq(portals.id, visit.portalId)).limit(1);
  if (!portal || portal.brandId !== link.brandId) return NextResponse.json({ error: "Unknown portal." }, { status: 400 });
  try {
    assertClaimAllowed(visit, portal);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Not allowed." }, { status: 400 });
  }

  // One claim per visit: a repeat submit while pending just corrects the email; a processed claim is final.
  const [existing] = await db
    .select({ id: claims.id, status: claims.status })
    .from(claims)
    .where(and(eq(claims.linkId, link.id), eq(claims.visitId, visit.id)))
    .limit(1);
  if (existing) {
    if (existing.status === "pending") await db.update(claims).set({ email, portalId: portal.id }).where(eq(claims.id, existing.id));
    return NextResponse.json({ ok: true });
  }
  const insert = db.insert(claims).values({
    id: crypto.randomUUID(),
    linkId: link.id,
    visitId: visit.id,
    portalId: portal.id,
    email,
    status: "pending",
    createdAt: Date.now(),
  });
  if (isProductLink) await insert;
  else await db.batch([insert, db.update(links).set({ status: "claimed" }).where(eq(links.id, link.id))]);
  return NextResponse.json({ ok: true });
}
