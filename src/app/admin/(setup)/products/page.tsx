import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { PageHeader, Card, Table, Th, Td, Tr, Pill, Button, buttonClass, Section, Textarea, Icons } from "@/components/ui";
import { getDb, products, highlights } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { getEnv } from "@/lib/env";
import { ensureProductLinks } from "@/lib/links";
import { CopyButton } from "../../(ops)/links/CopyButton";
import { Flash } from "../flash";
import { importProducts } from "./actions";
import { FromUrlForm } from "./FromUrlForm";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const db = await getDb();
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  // Join instead of inArray: D1 allows at most 100 bound parameters per query.
  const [ps, hs, linkMap, { APP_URL }] = await Promise.all([
    db.select().from(products).where(eq(products.brandId, active.id)).orderBy(products.market, sql`${products.priority} = 0`, products.priority, products.name),
    db.select({ productId: highlights.productId }).from(highlights).innerJoin(products, eq(products.id, highlights.productId)).where(eq(products.brandId, active.id)),
    ensureProductLinks(active.id),
    getEnv(),
  ]);
  const count = new Map<string, number>();
  for (const h of hs) count.set(h.productId, (count.get(h.productId) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Products"
                action={<Link href="/admin/products/new" className={buttonClass("primary")}><Icons.Plus size={16} aria-hidden /> Add product</Link>}
      />
      <Flash saved={sp.saved} error={sp.error} />
      <div className="mb-6 max-w-[760px]"><FromUrlForm back="list" compact /></div>
      <Card className="mb-6 overflow-x-auto pt-3.5">
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Market</Th><Th>Priority</Th><Th>Category</Th><Th>Highlights</Th><Th>Status</Th><Th><span className="sr-only">Review link</span></Th></tr>
          </thead>
          <tbody>
            {ps.length === 0 && (
              <tr><Td colSpan={7} className="text-ink-2">No products yet. Add one or import a CSV below.</Td></tr>
            )}
            {ps.map((p) => {
              return (
                <Tr key={p.id}>
                  <Td><Link href={`/admin/products/${p.id}`} className="font-semibold underline-offset-2 hover:underline">{p.name}</Link></Td>
                  <Td className="text-ink-2">{p.market || "-"}</Td>
                  <Td className="tabular-nums text-ink-2">{p.priority ? `P${p.priority}` : "-"}</Td>
                  <Td className="text-ink-2">{p.category || "-"}</Td>
                  <Td>{count.get(p.id) ?? 0}</Td>
                  <Td><Pill tone={p.active ? "green" : "neutral"} dot>{p.active ? "Active" : "Inactive"}</Pill></Td>
                  <Td className="text-right">{linkMap.get(p.id) && <CopyButton text={`${APP_URL}/r/${linkMap.get(p.id)!.token}`} label="Copy link" variant="ghost" />}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Section title="Import from CSV" description="Columns: name, category, knowledge.">
        <form action={importProducts} className="grid gap-3">
          <Textarea name="csv" rows={5} placeholder={'name,category,knowledge\nTrail Pack 30L,Backpack,"Waterproof base, fits a 15-inch laptop"'} className="font-mono text-[13px]" />
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv" className="text-[13px] text-ink-2 file:mr-3 file:h-8 file:cursor-pointer file:rounded file:border file:border-ink file:bg-white file:px-3 file:text-[13px] file:font-medium file:text-ink hover:file:bg-ink hover:file:text-white" />
            <Button type="submit" variant="line">Import</Button>
          </div>
        </form>
      </Section>
    </>
  );
}
