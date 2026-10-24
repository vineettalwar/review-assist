import Link from "next/link";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { PageHeader, Section } from "@/components/ui";
import { getDb, products, highlights, examples, memories, inspirations, settings, aiUsage } from "@/db";
import { requireActiveBrand } from "@/lib/brand";
import { getAiStatus, openRouterBalance, PROVIDERS, type OpenRouterBalance } from "@/lib/ai";
import { LANGUAGES } from "../constants";
import { TrainingLab, type LabProvider } from "./TrainingLab";

export const dynamic = "force-dynamic";

export const metadata = { title: "Training · Review Assist" };

/** Admin-only playground: compare models on the same prompt, react to drafts, and keep the taste library. */
export default async function TrainingPage() {
  const active = await requireActiveBrand();
  const db = await getDb();
  const since = Date.now() - 30 * DAY;
  const [ps, ai, insp, likes, rules, [st], balance, usage] = await Promise.all([
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
    db.select({ extra: settings.systemPromptExtra }).from(settings).where(eq(settings.id, "default")).limit(1),
    openRouterBalance().catch((): OpenRouterBalance => ({ connected: true, keyLimit: null, keyRemaining: null, keyUsage: null, accountCredits: null, accountUsage: null, error: "Couldn't reach OpenRouter." })),
    db
      .select({
        source: aiUsage.source, provider: aiUsage.provider, model: aiUsage.model, input: aiUsage.inputTokens, output: aiUsage.outputTokens,
        cost: aiUsage.costUsd, estimate: aiUsage.costSource, ok: aiUsage.ok, at: aiUsage.createdAt,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since))
      .orderBy(desc(aiUsage.createdAt))
      .limit(20_000),
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

  const liveCosts = usage.filter((u) => u.source === "live" && u.ok && u.cost != null);
  const avgLive = liveCosts.length ? liveCosts.reduce((s, u) => s + (u.cost ?? 0), 0) / liveCosts.length : null;

  return (
    <>
      <PageHeader
        title="Training"
        description="Try the same request on two models next to the no-AI fallback. What you like, dislike and find inspiring is saved and shapes every customer draft."
      />
      <BalanceBar balance={balance} activeProvider={ai.active?.id ?? null} avgLive={avgLive} />
      <TrainingLab
        currentExtra={st?.extra ?? ""}
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

      <UsageHistory rows={usage} avgLive={avgLive} />

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

const DAY = 24 * 60 * 60 * 1000;
const SOURCES = [
  { key: "live", label: "Customer drafts" },
  { key: "training", label: "Training" },
  { key: "preview", label: "Service-page previews" },
  { key: "import", label: "Site imports" },
  { key: "learning", label: "Learning from edits" },
] as const;

type UsageRow = { source: string; provider: string; model: string; input: number; output: number; cost: number | null; estimate: string | null; ok: boolean; at: number };

const money = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toPrecision(2)}` : `$${n.toFixed(n < 1 ? 3 : 2)}`);
const num = (n: number) => n.toLocaleString("en-US");

function sum(rows: UsageRow[]) {
  const priced = rows.filter((r) => r.cost != null);
  return {
    calls: rows.length,
    failed: rows.filter((r) => !r.ok).length,
    input: rows.reduce((s, r) => s + r.input, 0),
    output: rows.reduce((s, r) => s + r.output, 0),
    cost: priced.reduce((s, r) => s + (r.cost ?? 0), 0),
    estimated: priced.some((r) => r.estimate === "estimate"),
    unpriced: rows.filter((r) => r.ok && r.cost == null).length,
  };
}

function BalanceBar({ balance, activeProvider, avgLive }: { balance: OpenRouterBalance; activeProvider: string | null; avgLive: number | null }) {
  if (!balance.connected) {
    return (
      <p className="mb-6 rounded border border-rule px-4 py-3 text-[13px] text-ink-2">
        {activeProvider ? `Using ${PROVIDERS[activeProvider as keyof typeof PROVIDERS]?.label ?? activeProvider}: spending is tracked below, but this provider has no balance lookup.` : "No AI provider connected. Drafts use the template."}
      </p>
    );
  }
  // A key's limit can exceed what the account actually holds, so the real headroom is the smaller of the two.
  const accountLeft = balance.accountCredits != null && balance.accountUsage != null ? balance.accountCredits - balance.accountUsage : null;
  const options = [balance.keyRemaining, accountLeft].filter((v): v is number => v != null);
  const left = options.length ? Math.min(...options) : null;
  const items: [string, string][] = [];
  if (left != null) items.push(["Credits left", money(left)]);
  if (balance.keyLimit != null) items.push(["Key limit", money(balance.keyLimit)]);
  if (balance.keyUsage != null) items.push(["Used by this key", money(balance.keyUsage)]);
  if (balance.accountCredits != null) items.push(["Account credits", money(balance.accountCredits)]);
  if (balance.accountUsage != null) items.push(["Account used", money(balance.accountUsage)]);
  if (left != null && avgLive) items.push(["≈ Customer drafts left", num(Math.floor(left / avgLive))]);
  return (
    <div className="mb-6 rounded border border-rule px-4 py-3 text-[13px]">
      <div className="mb-1 font-semibold">OpenRouter balance</div>
      {items.length ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          {items.map(([k, v]) => (
            <div key={k} className="flex gap-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
          ))}
        </dl>
      ) : (
        <p className="text-ink-3">{balance.error || "No limit is set on this key, so OpenRouter reports no remaining balance. Set a credit limit on the key to see what's left."}</p>
      )}
    </div>
  );
}

function UsageHistory({ rows, avgLive }: { rows: UsageRow[]; avgLive: number | null }) {
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const windows = [
    { label: "Today", from: startOfDay },
    { label: "7 days", from: now - 7 * DAY },
    { label: "30 days", from: now - 30 * DAY },
  ];
  const models = [...new Set(rows.map((r) => `${r.provider} · ${r.model}`))];
  const cell = (s: ReturnType<typeof sum>) =>
    s.calls ? `${num(s.calls)} · ${money(s.cost)}${s.estimated ? " est." : ""}${s.failed ? ` · ${s.failed} failed` : ""}` : "—";
  return (
    <div className="mt-8 rounded border border-rule p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Usage history</h2>
        <span className="text-[12px] text-ink-3">All clients. Calls · cost{avgLive != null ? ` · average customer draft ${money(avgLive)}` : ""}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">No AI calls recorded yet. They appear here as drafts are written.</p>
      ) : (
        <div className="grid gap-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-ink-3">
                <tr><th className="py-1 pr-4 font-normal">Used for</th>{windows.map((w) => <th key={w.label} className="py-1 pr-4 font-normal">{w.label}</th>)}</tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.key} className="border-t border-rule">
                    <td className="py-1.5 pr-4">{s.label}</td>
                    {windows.map((w) => <td key={w.label} className="py-1.5 pr-4 tabular-nums">{cell(sum(rows.filter((r) => r.source === s.key && r.at >= w.from)))}</td>)}
                  </tr>
                ))}
                <tr className="border-t border-ink font-medium">
                  <td className="py-1.5 pr-4">Total</td>
                  {windows.map((w) => <td key={w.label} className="py-1.5 pr-4 tabular-nums">{cell(sum(rows.filter((r) => r.at >= w.from)))}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-ink-3">
                <tr><th className="py-1 pr-4 font-normal">Model (30 days)</th><th className="py-1 pr-4 font-normal">Calls</th><th className="py-1 pr-4 font-normal">Tokens in / out</th><th className="py-1 pr-4 font-normal">Cost</th><th className="py-1 font-normal">Avg per call</th></tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const s = sum(rows.filter((r) => `${r.provider} · ${r.model}` === m));
                  const priced = s.calls - s.failed - s.unpriced;
                  return (
                    <tr key={m} className="border-t border-rule">
                      <td className="py-1.5 pr-4 font-mono text-[12px]">{m}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{num(s.calls)}{s.failed ? ` (${s.failed} failed)` : ""}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{num(s.input)} / {num(s.output)}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{money(s.cost)}{s.estimated ? " est." : ""}{s.unpriced ? ` +${s.unpriced} unpriced` : ""}</td>
                      <td className="py-1.5 tabular-nums">{priced > 0 ? money(s.cost / priced) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
