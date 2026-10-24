import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { PageHeader, Section } from "@/components/ui";
import { getDb, products, highlights, examples, memories, inspirations } from "@/db";
import { requireActiveBrand } from "@/lib/brand";
import { getAiStatus, PROVIDERS } from "@/lib/ai";
import { LANGUAGES } from "../constants";
import { TrainingLab, type LabProvider } from "./TrainingLab";

export const dynamic = "force-dynamic";

export const metadata = { title: "Training · Review Assist" };

/** Admin-only playground: compare models on the same prompt, react to drafts, and keep the taste library. */
export default async function TrainingPage() {
  const active = await requireActiveBrand();
  const db = await getDb();
  const [ps, ai, insp, likes, rules] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products).where(eq(products.brandId, active.id)).orderBy(asc(products.createdAt)),
    getAiStatus(),
    db.select().from(inspirations).where(eq(inspirations.brandId, active.id)).orderBy(desc(inspirations.createdAt)),
    db.select().from(examples).where(eq(examples.brandId, active.id)).orderBy(desc(examples.createdAt)).limit(8),
    db
      .select()
      .from(memories)
      .where(and(eq(memories.brandId, active.id), eq(memories.status, "active"), inArray(memories.kind, ["style", "avoid"])))
      .orderBy(desc(memories.createdAt))
      .limit(12),
  ]);
  const hs = ps.length
    ? await db.select().from(highlights).where(inArray(highlights.productId, ps.map((p) => p.id))).orderBy(asc(highlights.sort))
    : [];
  const name = new Map(ps.map((p) => [p.id, p.name]));

  const providers: LabProvider[] = ai.providers.map((p) => ({
    id: p.id,
    label: PROVIDERS[p.id].label,
    connected: p.connected,
    model: p.model,
    models: PROVIDERS[p.id].models,
  }));

  return (
    <>
      <PageHeader
        title="Training"
        description="Try the same request on two models next to the no-AI fallback. What you like, dislike and find inspiring is saved and shapes every customer draft."
      />
      <TrainingLab
        products={ps.map((p) => ({
          id: p.id,
          name: p.name,
          highlights: hs.filter((h) => h.productId === p.id).map((h) => ({ id: h.id, label: h.label, polarity: h.polarity })),
        }))}
        languages={LANGUAGES}
        defaultLanguage={active.defaultLanguage}
        providers={providers}
        activeProvider={ai.active?.id ?? null}
        inspirations={insp.map((i) => ({ id: i.id, text: i.text, note: i.note, active: i.active, scope: i.productId ? (name.get(i.productId) ?? "Removed service") : null }))}
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <Section title="Liked drafts" description="Saved as examples. The model copies their tone and structure.">
          {likes.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing liked yet. Press Like on a draft you&apos;d be happy to post.</p>
          ) : (
            <ul className="grid gap-2">
              {likes.map((e) => (
                <li key={e.id} className="flex gap-3 rounded border border-rule px-3 py-2.5 text-sm">
                  <span className="flex-none tabular-nums text-ink-3">{e.rating}★</span>
                  <span className="line-clamp-3 flex-1">{e.text}</span>
                  {e.productId && (
                    <Link href={`/admin/products/${e.productId}#examples`} className="flex-none text-[13px] text-carbon underline underline-offset-2">
                      {name.get(e.productId) ?? "Service"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Rules" description="From dislikes, never-say phrases and the Brain. Newest first.">
          {rules.length === 0 ? (
            <p className="text-sm text-ink-3">No rules yet. Dislike a draft or select a phrase and press Never say this.</p>
          ) : (
            <ul className="grid gap-2">
              {rules.map((m) => (
                <li key={m.id} className="flex gap-3 rounded border border-rule px-3 py-2.5 text-sm">
                  <span className="flex-1">{m.text}</span>
                  <span className="flex-none text-[12px] text-ink-3">{m.productId ? (name.get(m.productId) ?? "Service") : "Whole brand"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px]">
            <Link href="/admin/memory" className="font-medium text-carbon underline underline-offset-2">Edit or archive rules in Brain</Link>
          </p>
        </Section>
      </div>
    </>
  );
}
