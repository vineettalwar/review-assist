import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, portals, products, submissions, visits } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { Card, Input, PageHeader, Pill, Select, SubmitButton, Table, Td, Textarea, Th, Tr, buttonClass } from "@/components/ui";
import { relativeTime } from "./languages";
import { setTracking } from "./actions";

const TRACK_LABEL = { submitted: "Submitted", pending: "Pending", published: "Published", rejected: "Rejected" } as const;
const TRACK_TONE = { submitted: "neutral", pending: "blue", published: "green", rejected: "amber" } as const;

type TrackRow = { id: string; trackStatus: keyof typeof TRACK_LABEL; publishedUrl: string; screenshotUrl: string; trackNotes: string };

/** Status on the portal plus proof links, edited in place after checking the site. */
function TrackingCell({ r }: { r: TrackRow }) {
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <Pill tone={TRACK_TONE[r.trackStatus]}>{TRACK_LABEL[r.trackStatus]}</Pill>
        {r.publishedUrl && <span className="ml-1.5 text-ink-3">· link</span>}
      </summary>
      <form action={setTracking} className="mt-2 grid w-64 gap-2">
        <input type="hidden" name="id" value={r.id} />
        <Select name="status" defaultValue={r.trackStatus} aria-label="Status">
          {Object.entries(TRACK_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input name="publishedUrl" type="url" placeholder="Published review URL" defaultValue={r.publishedUrl} aria-label="Published review URL" />
        <Input name="screenshotUrl" type="url" placeholder="Screenshot link" defaultValue={r.screenshotUrl} aria-label="Screenshot link" />
        <Textarea name="notes" rows={2} placeholder="Notes" defaultValue={r.trackNotes} aria-label="Notes" />
        <div><SubmitButton size="sm">Save</SubmitButton></div>
      </form>
    </details>
  );
}

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  const db = await getDb();

  const [productRows, portalRows, responses] = await Promise.all([
    db.select().from(products).where(eq(products.brandId, b.id)).orderBy(products.name),
    db.select({ id: portals.id, label: portals.label }).from(portals).where(eq(portals.brandId, b.id)),
    db
      .select()
      .from(visits)
      .where(and(eq(visits.brandId, b.id), isNotNull(visits.copiedAt)))
      .orderBy(desc(visits.copiedAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const productName = new Map(productRows.map((p) => [p.id, p.name]));
  const portalLabel = new Map(portalRows.map((p) => [p.id, p.label]));
  const hasNext = responses.length > PAGE_SIZE;
  const rows = responses.slice(0, PAGE_SIZE);
  // The review each customer actually posted: latest submission per visit (a visit can copy up to 3 times).
  const subs = rows.length
    ? await db
        .select({
          id: submissions.id, visitId: submissions.visitId, finalText: submissions.finalText, edited: submissions.edited, createdAt: submissions.createdAt,
          trackStatus: submissions.trackStatus, publishedUrl: submissions.publishedUrl, screenshotUrl: submissions.screenshotUrl, trackNotes: submissions.trackNotes,
        })
        .from(submissions)
        .where(and(eq(submissions.brandId, b.id), inArray(submissions.visitId, rows.map((v) => v.id))))
    : [];
  const reviewOf = new Map<string, (typeof subs)[number]>();
  for (const x of subs) if ((reviewOf.get(x.visitId)?.createdAt ?? -1) < x.createdAt) reviewOf.set(x.visitId, x);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Responses"
        action={
          rows.length > 0 ? (
            <span className="flex gap-2">
              <a href="/admin/links/tracking" className={buttonClass("line", "sm")} download>Tracking sheet</a>
              <a href="/admin/links/export" className={buttonClass("line", "sm")} download>Export CSV</a>
            </span>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">No responses yet. Copy a review link from any product to get the first one.</Card>
      ) : (
        <>
          <Card className="overflow-x-auto pt-3.5">
            <Table>
              <thead>
                <tr><Th>Customer</Th><Th>Review</Th><Th>Product</Th><Th>Rating</Th><Th className="hidden md:table-cell">Posted to</Th><Th className="hidden sm:table-cell">When</Th><Th>Tracking</Th></tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <Tr key={v.id}>
                    <Td>
                      <span className="block font-medium">{v.name || "—"}</span>
                      {v.email && <a href={`mailto:${v.email}`} className="text-[13px] text-ink-3 hover:underline">{v.email}</a>}
                      {v.contactOptInAt && (
                        <span className="mt-0.5 block text-[11px] tracking-[0.04em] text-carbon" title={`Opted in ${new Date(v.contactOptInAt).toLocaleString()}`}>
                          OK TO CONTACT
                        </span>
                      )}
                    </Td>
                    <Td className="min-w-64 max-w-md">
                      {(() => {
                        const r = reviewOf.get(v.id);
                        if (!r) return <span className="text-ink-3">—</span>;
                        return (
                          <details className="group text-[13px]">
                            <summary className="cursor-pointer list-none text-ink-2 [&::-webkit-details-marker]:hidden">
                              <span className="line-clamp-2 group-open:hidden">{r.finalText}</span>
                              <span className="hidden text-ink-3 group-open:inline">Hide</span>
                              {r.edited && <Pill className="ml-0 mt-1">Edited by customer</Pill>}
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap text-ink">{r.finalText}</p>
                          </details>
                        );
                      })()}
                    </Td>
                    <Td>{productName.get(v.productId) ?? "Removed product"}{v.language !== "en" && <span className="ml-1.5 text-[12px] text-ink-3">{v.language.toUpperCase()}</span>}</Td>
                    <Td className="tabular-nums">{v.rating ? `${v.rating}★` : "—"}</Td>
                    <Td className="hidden md:table-cell">{(v.portalId && portalLabel.get(v.portalId)) || "—"}</Td>
                    <Td className="hidden text-ink-3 sm:table-cell">{relativeTime(v.copiedAt ?? v.createdAt, now)}</Td>
                    <Td>{(() => {
                      const r = reviewOf.get(v.id);
                      return r ? <TrackingCell r={r} /> : <span className="text-ink-3">—</span>;
                    })()}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
          {(page > 1 || hasNext) && (
            <div className="mt-4 flex items-center justify-between text-sm text-ink-2">
              {page > 1 ? <Link className={buttonClass("line", "sm")} href={`/admin/links?page=${page - 1}`}>Newer</Link> : <span />}
              <span>Page {page}</span>
              {hasNext ? <Link className={buttonClass("line", "sm")} href={`/admin/links?page=${page + 1}`}>Older</Link> : <span />}
            </div>
          )}
        </>
      )}
    </>
  );
}
