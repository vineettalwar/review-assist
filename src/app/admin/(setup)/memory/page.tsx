import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Section, Button, Icons } from "@/components/ui";
import { getDb, products, highlights, settings, type Memory } from "@/db";
import { angleCount, brandChecks, productChecks } from "@/lib/context-score";
import { parseLanguages } from "@/lib/i18n/languages";
import { Card, Table, Td, Th, Tr } from "@/components/ui";
import { getActiveBrand } from "@/lib/brand";
import { listMemories } from "@/lib/memory";
import { Flash } from "../flash";
import { AddMemoryForm, MemoryItem } from "./MemoryItem";
import { learnFromEdits } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  const db = await getDb();
  let failed = false;
  const [ps, hs, [st], all] = await Promise.all([
    db.select().from(products).where(eq(products.brandId, b.id)).orderBy(asc(products.name)),
    db.select({ productId: highlights.productId, polarity: highlights.polarity, labelJa: highlights.labelJa }).from(highlights).innerJoin(products, eq(products.id, highlights.productId)).where(eq(products.brandId, b.id)),
    db.select({ languages: settings.languages }).from(settings).where(eq(settings.id, "default")),
    listMemories(b.id, { status: "all" }).catch((): Memory[] => {
      failed = true;
      return [];
    }),
  ]);
  const pname = new Map(ps.map((p) => [p.id, p.name]));
  const proposed = all.filter((m) => m.status === "proposed");
  const active = all.filter((m) => m.status === "active");
  const scopeOf = (m: Memory) => (m.productId ? pname.get(m.productId) ?? "Product" : "Brand");
  const R = "/admin/memory";
  const ja = parseLanguages(st?.languages).includes("ja");
  const bc = brandChecks(b);
  const memCount = (pid: string | null) => active.filter((m) => m.productId === pid).length;

  return (
    <>
      <PageHeader title="Brain" />
      <Flash saved={sp.saved} error={sp.error} />

      <Section title="Brand profile">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="font-semibold">{bc.filter((c) => c.ok).length}/{bc.length} filled</span>
          {bc.map((c) => <span key={c.label} className={c.ok ? "text-ink-2" : "text-ink-3 line-through decoration-rule"}>{c.label}</span>)}
          <span className="text-ink-3">{memCount(null)} brand memories</span>
          <span className="ml-auto flex gap-4">
            <Link href="/admin/training#examples" className="text-[13px] font-medium text-carbon underline underline-offset-2">Brand-wide examples</Link>
            <Link href="/admin/brand" className="text-[13px] font-medium text-carbon underline underline-offset-2">Edit brand</Link>
          </span>
        </div>
      </Section>

      {ps.length > 0 && (
        <Section title="Product context">
          <Card className="overflow-x-auto pt-2">
            <Table>
              <thead><tr><Th>Product</Th><Th>Context</Th><Th className="text-right">Angles</Th><Th className="hidden text-right sm:table-cell">Memories</Th></tr></thead>
              <tbody>
                {ps.map((p) => {
                  const c = productChecks(p, hs.filter((h) => h.productId === p.id), ja);
                  const done = c.filter((x) => x.ok).length;
                  return (
                    <Tr key={p.id}>
                      <Td><Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link></Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface" aria-hidden><span className="block h-full rounded-full bg-carbon" style={{ width: `${(done / c.length) * 100}%` }} /></span>
                          <span className="tabular-nums text-[13px] text-ink-2">{done}/{c.length}</span>
                          {done < c.length && <span className="hidden text-[12px] text-ink-3 md:inline">Missing: {c.filter((x) => !x.ok).map((x) => x.label).join(", ")}</span>}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums">{angleCount(p)}</Td>
                      <Td className="hidden text-right tabular-nums sm:table-cell">{memCount(p.id)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </Section>
      )}
      {failed && <p className="mb-4 text-sm text-ink-2">Memory isn&apos;t available right now. Try again in a moment.</p>}

      <form action={learnFromEdits} className="mb-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="returnTo" value={R} />
        <Button type="submit" variant="line"><Icons.Pencil size={16} aria-hidden /> Learn from customer edits</Button>
        
      </form>

      <div id="waiting" className="scroll-mt-6">
        <Section title="Waiting for review" description={proposed.length ? "Not used until approved." : "Nothing waiting."}>
          {proposed.length > 0 && (
            <ul className="grid gap-2">
              {proposed.map((m) => <MemoryItem key={m.id} m={m} scope={scopeOf(m)} returnTo={R} />)}
            </ul>
          )}
        </Section>
      </div>

      <div id="brand" className="scroll-mt-6">
        <Section title="Brand memory">
          <ul className="grid gap-2">
            {active.filter((m) => !m.productId).map((m) => <MemoryItem key={m.id} m={m} scope="Brand" returnTo={R} />)}
            {active.every((m) => m.productId) && <li className="text-sm text-ink-2">No brand-level memory yet.</li>}
          </ul>
          <AddMemoryForm productId={null} returnTo={R} />
        </Section>
      </div>

      {ps.map((p) => {
        const mine = active.filter((m) => m.productId === p.id);
        return (
          <div key={p.id} id={`product-${p.id}`} className="scroll-mt-6">
            <Section title={p.name}>
              <ul className="grid gap-2">
                {mine.map((m) => <MemoryItem key={m.id} m={m} scope={p.name} returnTo={`${R}#product-${p.id}`} />)}
                {mine.length === 0 && <li className="text-sm text-ink-2">No memory for this product yet.</li>}
              </ul>
              <AddMemoryForm productId={p.id} returnTo={`${R}#product-${p.id}`} />
            </Section>
          </div>
        );
      })}
    </>
  );
}
