import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, asc, desc, sql } from "drizzle-orm";
import { PageHeader, Section, QuestionFlow, BigInput, BigTextarea, Button, Field, Icons, Select, Textarea, buttonClass } from "@/components/ui";
import { getDb, products, highlights, portals, productPortals, settings, examples, visits } from "@/db";
import { getEnv } from "@/lib/env";
import { ensureProductLinks } from "@/lib/links";
import { CopyButton } from "../../../(ops)/links/CopyButton";
import { setLinkDisabled } from "../../../(ops)/links/actions";
import { Playground } from "../../training/Playground";
import { addExample, deleteExample } from "../../training/actions";
import { LANGUAGES } from "../../constants";
import { parseLanguages } from "@/lib/i18n/languages";
import { buildPrompt } from "@/lib/generation";
import { loadContext } from "@/lib/generation/context";
import { getActiveBrand } from "@/lib/brand";
import { MemoryPanel } from "../../memory/MemoryPanel";
import { Flash } from "../../flash";
import { saveProduct, deleteProduct } from "../actions";
import { HighlightEditor } from "./HighlightEditor";
import { DeleteProduct } from "./DeleteProduct";
import { ActiveToggle } from "./ActiveToggle";
import { ScanPanel } from "./ScanPanel";
import { FromUrlForm } from "../FromUrlForm";

export const dynamic = "force-dynamic";


export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const db = await getDb();
  const isNew = id === "new";
  const [p] = isNew ? [] : await db.select().from(products).where(and(eq(products.id, id), eq(products.brandId, active.id)));
  if (!isNew && !p) notFound();
  const [hs, allPortals, links, [st], ctx, exs, linkMap, [stat], { APP_URL }] = await Promise.all([
    isNew ? Promise.resolve([]) : db.select().from(highlights).where(eq(highlights.productId, id)).orderBy(asc(highlights.sort)),
    db.select().from(portals).where(eq(portals.brandId, active.id)).orderBy(asc(portals.sort)),
    isNew ? Promise.resolve([]) : db.select().from(productPortals).where(eq(productPortals.productId, id)),
    db.select({ languages: settings.languages }).from(settings).where(eq(settings.id, "default")),
    isNew ? Promise.resolve(null) : loadContext(id, 5, [], "en").catch(() => null),
    isNew ? Promise.resolve([]) : db.select().from(examples).where(and(eq(examples.brandId, active.id), eq(examples.productId, id))).orderBy(desc(examples.createdAt)),
    isNew ? Promise.resolve(new Map()) : ensureProductLinks(active.id),
    isNew ? Promise.resolve([]) : db.select({ opens: sql<number>`count(*)`, copies: sql<number>`count(${visits.copiedAt})` }).from(visits).where(and(eq(visits.brandId, active.id), eq(visits.productId, id))),
    getEnv(),
  ]);
  const link = isNew ? undefined : linkMap.get(id);
  const linkUrl = link ? `${APP_URL}/r/${link.token}` : "";
  const linkOff = link?.status === "disabled";
  const back = `/admin/products/${id}`;
  const langs = parseLanguages(st?.languages);
  const showJa = langs.includes("ja") || p?.market === "JP";
  const showDe = langs.includes("de") || p?.market === "DE";
  const preview = ctx
    ? buildPrompt({ brand: ctx.brand, product: ctx.product, examples: ctx.examples, memory: ctx.memory, link: { language: "en", visitNotes: "" }, rating: 5, highlights: [], length: "short", variant: 0 })
    : null;
  const chosen = new Set(links.map((l) => l.portalId));

  return (
    <>
      <PageHeader
        title={isNew ? "New product" : p.name}
        description={<><Link href="/admin/products" className="underline underline-offset-2">Products</Link> / {isNew ? "New" : "Edit"}</>}
      />
      <Flash saved={sp.saved} error={sp.error} />
      {link && (
        <div className="mb-8 flex max-w-[760px] flex-wrap items-center gap-x-4 gap-y-2 rounded border border-rule bg-surface px-4 py-3 lg:ml-[232px]">
          <span className="text-[13px] font-medium text-ink-2">Review link</span>
          <a href={linkUrl} target="_blank" rel="noreferrer" className={`font-mono text-[13px] hover:underline ${linkOff ? "text-ink-3 line-through" : "text-carbon"}`}>/r/{link.token}</a>
          <span className="text-[12px] tabular-nums text-ink-3">{stat?.opens ?? 0} visits · {stat?.copies ?? 0} reviews</span>
          <div className="ml-auto flex items-center gap-1">
            <CopyButton text={linkUrl} label="Copy" variant="ghost" />
            <a href={linkUrl} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}>Open <Icons.ExternalLink size={13} aria-hidden /></a>
            <form action={setLinkDisabled}>
              <input type="hidden" name="id" value={link.id} />
              <input type="hidden" name="disable" value={linkOff ? "0" : "1"} />
              <Button type="submit" variant="ghost" size="sm">{linkOff ? "Turn on" : "Turn off"}</Button>
            </form>
          </div>
        </div>
      )}
      {isNew ? (
        <div className="mb-8 max-w-[760px] lg:ml-[232px]">
          <Section title="Add from a product page">
            <FromUrlForm back="new" />
          </Section>
          <div className="flex items-center gap-3 text-[13px] text-ink-3" role="separator"><span className="h-px flex-1 bg-rule" />or fill in by hand<span className="h-px flex-1 bg-rule" /></div>
        </div>
      ) : (
        <div className="max-w-[760px] lg:ml-[232px]">
          <Section title="Learn from page">
            <ScanPanel productId={id} initialUrl={p.url} />
          </Section>
        </div>
      )}
      <form action={saveProduct.bind(null, id)}>
        <QuestionFlow
          submitLabel={isNew ? "Create product" : "Save product"}
          questions={[
            {
              title: "What's the product called?",
              htmlFor: "name",
              required: true,
              body: (
                <div className="grid gap-6">
                  <BigInput id="name" name="name" defaultValue={p?.name ?? ""} required />
                  <ActiveToggle initial={p?.active ?? true} />
                </div>
              ),
            },
            { title: "What kind of product is it?", hint: "e.g. Electric SUV", htmlFor: "category", body: <BigInput id="category" name="category" defaultValue={p?.category ?? ""} /> },
            { title: "Where's the product page?", hint: "Optional.", htmlFor: "url", body: <BigInput id="url" name="url" type="url" placeholder="https://" defaultValue={p?.url ?? ""} /> },
            {
              title: "Which market is it reviewed in?",
              hint: "Fixes the language of its review link: US English, Germany German, Japan Japanese. Priority 1 is the highest.",
              htmlFor: "market",
              body: (
                <div className="flex flex-wrap gap-4">
                  <Field label="Market" className="w-[220px]">
                    <Select id="market" name="market" defaultValue={p?.market ?? ""}>
                      <option value="">Any (follow the visitor)</option>
                      <option value="US">United States</option>
                      <option value="DE">Germany</option>
                      <option value="JP">Japan</option>
                    </Select>
                  </Field>
                  <Field label="Priority" className="w-[140px]">
                    <Select name="priority" defaultValue={String(p?.priority ?? 0)}>
                      <option value="0">Not set</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                </div>
              ),
            },
            { title: "What are the key facts?", hint: "Features, specs, what's included. One per line.", htmlFor: "knowledge", long: true, body: <BigTextarea id="knowledge" name="knowledge" rows={5} defaultValue={p?.knowledge ?? ""} /> },
            { title: "Who is it for?", hint: "e.g. Families switching from a petrol SUV", htmlFor: "audience", long: true, body: <BigTextarea id="audience" name="audience" rows={2} defaultValue={p?.audience ?? ""} /> },
            { title: "What moments do customers go through?", hint: "e.g. Test drive, Delivery day, First road trip", htmlFor: "experience", long: true, body: <BigTextarea id="experience" name="experience" defaultValue={p?.experience ?? ""} /> },
            { title: "What do happy customers praise?", htmlFor: "praise", long: true, body: <BigTextarea id="praise" name="praise" defaultValue={p?.praise ?? ""} /> },
            { title: "What do people sometimes raise?", hint: "Only used for lower ratings.", htmlFor: "concerns", long: true, body: <BigTextarea id="concerns" name="concerns" defaultValue={p?.concerns ?? ""} /> },
            { title: "Anything to never mention?", hint: "e.g. prices, discounts, medical claims", htmlFor: "avoid", long: true, body: <BigTextarea id="avoid" name="avoid" rows={2} defaultValue={p?.avoid ?? ""} /> },
            {
              title: "Which highlights can customers tap?",
              hint: "Points: positive show for 4–5 stars, negative for 1–3. Situations (where, why, how long) show for every rating.",
              body: <HighlightEditor showJa={showJa} showDe={showDe} initial={hs.map((h) => ({ id: h.id, label: h.label, labelJa: h.labelJa, labelDe: h.labelDe, polarity: h.polarity, kind: h.kind }))} />,
            },
            {
              title: "Where should reviews go?",
              hint: allPortals.length ? "None checked uses your brand defaults." : undefined,
              body: allPortals.length === 0 ? (
                <p className="text-[15px] text-ink-2">No portals yet. <Link href="/admin/portals" className="underline underline-offset-2">Add one</Link>.</p>
              ) : (
                <div className="grid max-w-[360px] gap-2">
                  {allPortals.map((po) => (
                    <label key={po.id} className="flex h-12 cursor-pointer items-center gap-3 rounded border border-rule px-3 text-[16px] transition-colors hover:border-rule-strong has-[:checked]:border-carbon has-[:checked]:bg-wash">
                      <input type="checkbox" name="portal" value={po.id} defaultChecked={chosen.has(po.id)} className="size-4 accent-[var(--color-carbon)]" />
                      {po.label}{po.isDefault && <span className="text-xs text-ink-3">default</span>}
                    </label>
                  ))}
                </div>
              ),
            },
          ]}
        />
        {preview && (
          <details className="mt-4 rounded border border-rule lg:ml-[232px]">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-ink-3">Prompt preview</summary>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap border-t border-rule bg-wash px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-2">{preview.system + "\n\n---\n\n" + preview.user}</pre>
          </details>
        )}
      </form>

      {!isNew && (
        <div id="try" className="mt-12 scroll-mt-6 lg:ml-[232px]">
          <Section title="Try a draft">
            <Playground
              products={[{ id, name: p.name, highlights: hs.map((h) => ({ id: h.id, label: h.label, polarity: h.polarity })) }]}
              languages={LANGUAGES}
              defaultLanguage={active.defaultLanguage}
            />
          </Section>
        </div>
      )}

      {!isNew && (
        <div id="examples" className="max-w-[760px] scroll-mt-6 lg:ml-[232px]">
          <Section title="Examples" description="Tone and structure only.">
            {exs.length > 0 && (
              <ul className="mb-4 grid gap-2">
                {exs.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded border border-rule px-3 py-2.5 text-sm">
                    <span className="flex-none tabular-nums text-ink-3">{e.rating}★</span>
                    <span className="line-clamp-3 flex-1">{e.text}</span>
                    <form action={deleteExample.bind(null, e.id)}>
                      <input type="hidden" name="returnTo" value={back} />
                      <Button type="submit" variant="ghost" size="sm" aria-label="Delete example"><Icons.Trash2 size={14} aria-hidden /></Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-[13px] font-medium text-carbon">Add an example</summary>
              <form action={addExample} className="mt-3 grid gap-3">
                <input type="hidden" name="returnTo" value={back} />
                <input type="hidden" name="productId" value={id} />
                <Field label="Rating" className="max-w-[160px]">
                  <Select name="rating" defaultValue="5" aria-label="Rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}</Select>
                </Field>
                <Field label="Review text"><Textarea name="text" rows={3} required aria-label="Review text" /></Field>
                <div><Button type="submit" size="sm"><Icons.Plus size={14} aria-hidden /> Add</Button></div>
              </form>
            </details>
          </Section>
        </div>
      )}

      {!isNew && (
        <div className="mt-10 max-w-[760px] lg:ml-[232px]">
          <MemoryPanel brandId={active.id} productId={id} returnTo={`/admin/products/${id}`} title="Memory" />
        </div>
      )}

      {!isNew && (
        <div className="mt-10 max-w-[760px] lg:ml-[232px] border-t border-rule pt-6">
          <DeleteProduct action={deleteProduct.bind(null, id)} name={p.name} />
        </div>
      )}
    </>
  );
}
