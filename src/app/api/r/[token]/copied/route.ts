import { NextResponse } from "next/server";
import { and, eq, count } from "drizzle-orm";
import { getDb, links, submissions, visits } from "@/db";
import { getLinkByToken, resolvePortals } from "@/app/r/resolve";
import { readVisit } from "@/lib/visit";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const MAX_SUBMISSIONS_PER_VISIT = 3;
const EMAIL = /^[^\s@<>"',;]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;

/** The customer copied their review and is heading to a portal. Stores name and email on the visit (never sent to the AI). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (Number(req.headers.get("content-length") ?? 0) > 40_000) return NextResponse.json({ error: "Too large." }, { status: 413 });
  if (!(await rateLimit(`copied:ip:${clientIp(req.headers)}`, 30, 60 * 60 * 1000)).ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const portalId = typeof body?.portalId === "string" ? body.portalId : "";
  const finalText = body?.finalText;
  const draftText = body?.draftText ?? "";
  const rating = body?.rating;
  const edited = body?.edited;
  const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (
    typeof finalText !== "string" || finalText.length < 1 || finalText.length > 5000 ||
    typeof draftText !== "string" || draftText.length > 5000 ||
    typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 5 ||
    typeof edited !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  // Name and email are optional; an email that is given must be valid.
  if (name.length > 80) return NextResponse.json({ error: "Name is too long.", field: "name" }, { status: 400 });
  if (email && (email.length > 254 || !EMAIL.test(email))) return NextResponse.json({ error: "Enter a valid email address.", field: "email" }, { status: 400 });

  const link = await getLinkByToken(token);
  if (!link || link.status === "disabled") return NextResponse.json({ error: "Link not active." }, { status: 404 });
  const visit = await readVisit(link.id, body?.visit);
  if (!visit) return NextResponse.json({ error: "This page has expired. Reload to continue." }, { status: 410 });
  const ps = await resolvePortals(link.productId, link.brandId);
  if (!ps.some((p) => p.id === portalId)) return NextResponse.json({ error: "Unknown portal." }, { status: 400 });

  const db = await getDb();
  const now = Date.now();
  // Consent only counts with an email to contact and an explicit tick; the timestamp is the record of it.
  const contactOptInAt = email && body?.contactOk === true ? now : null;
  const [[{ n }]] = await Promise.all([
    db.select({ n: count() }).from(submissions).where(and(eq(submissions.linkId, link.id), eq(submissions.visitId, visit.visitId))),
    db
      .insert(visits)
      .values({ id: visit.visitId, linkId: link.id, brandId: link.brandId, productId: link.productId, language: visit.lang, name, email, contactOptInAt, rating, portalId, createdAt: now, copiedAt: now })
      .onConflictDoUpdate({ target: visits.id, set: { name, email, contactOptInAt, rating, portalId, copiedAt: now } }),
    db
      .update(links)
      .set({ portalId, copiedAt: now, ...(link.status === "claimed" || link.kind === "product" ? {} : { status: "copied" as const }) })
      .where(eq(links.id, link.id)),
  ]);
  if (n < MAX_SUBMISSIONS_PER_VISIT) {
    await db.insert(submissions).values({
      id: crypto.randomUUID(),
      brandId: link.brandId,
      linkId: link.id,
      visitId: visit.visitId,
      productId: link.productId,
      portalId,
      rating,
      draftText,
      finalText,
      edited,
      createdAt: now,
    });
  }
  return NextResponse.json({ ok: true });
}
