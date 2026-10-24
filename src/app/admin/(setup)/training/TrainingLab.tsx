"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Input, Segmented, Select, Textarea, cn } from "@/components/ui";
import {
  addInspiration, deleteInspiration, dislikeDraft, neverSay, runRawRequest, runTraining, saveDefaultExtra, saveExampleFromPlayground, setInspirationActive,
  type TrainingResult,
} from "./actions";
import { proposeFromPlayground } from "../memory/actions";
import { DISLIKE_REASONS } from "./reasons";

type Polarity = "pos" | "neg" | "both";
type LabProduct = { id: string; name: string; highlights: { id: string; label: string; polarity: Polarity }[] };
export type LabProvider = { id: "openrouter" | "anthropic" | "openai"; label: string; connected: boolean; model: string; models: string[] };
type LabInspiration = { id: string; text: string; note: string; active: boolean; scope: string | null };
type ColumnSetup = { provider: string; model: string };
/** `request` is the editable JSON for this column; the fallback column has none. */
type Draft = { text: string; original: string; result: TrainingResult | null; request: string };
type Tally = { drafts: number; input: number; output: number; cost: number; priced: number; estimated: boolean };

const STAR = "M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.27 6.38L12 17.05 6.31 20.23l1.27-6.38L2.8 9.45l6.45-.75z";
const TALLY_KEY = "ra-training-usage";
const EMPTY: Draft = { text: "", original: "", result: null, request: "" };

const money = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toPrecision(2)}` : `$${n.toFixed(3)}`);
const num = (n: number) => n.toLocaleString("en-US");

function usageLine(r: TrainingResult | null) {
  if (!r) return "";
  if (!r.ok) return "";
  const time = `${(r.ms / 1000).toFixed(1)}s`;
  if (!r.usage) return `usage not reported · ${time}`;
  const u = r.usage;
  const cost = u.costUsd == null ? "cost unknown" : `${money(u.costUsd)}${u.costSource === "estimate" ? " est." : ""}`;
  return `in ${num(u.input)} · out ${num(u.output)} tokens · ${cost} · ${time}`;
}

function readTally(): Record<string, Tally> {
  try {
    return JSON.parse(sessionStorage.getItem(TALLY_KEY) || "{}") as Record<string, Tally>;
  } catch {
    return {};
  }
}

export function TrainingLab({
  products, languages, defaultLanguage, providers, activeProvider, inspirations, currentExtra,
}: {
  products: LabProduct[];
  languages: readonly { value: string; label: string }[];
  defaultLanguage: string;
  providers: LabProvider[];
  activeProvider: string | null;
  inspirations: LabInspiration[];
  /** Settings extra instructions now applied to every customer draft. */
  currentExtra: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [rating, setRating] = useState(5);
  const [picked, setPicked] = useState<string[]>([]);
  const [length, setLength] = useState<"short" | "detailed">("short");
  const [language, setLanguage] = useState(defaultLanguage);
  const [notes, setNotes] = useState("");
  const [variant, setVariant] = useState(0);
  const [scope, setScope] = useState<"brand" | "product">("brand");

  const firstProvider = providers.find((p) => p.id === activeProvider) ?? providers.find((p) => p.connected) ?? providers[0];
  const [cols, setCols] = useState<ColumnSetup[]>(() => {
    const a = firstProvider?.model ?? "";
    const b = firstProvider?.models.find((m) => m !== a) ?? a;
    return [{ provider: firstProvider?.id ?? "openrouter", model: a }, { provider: firstProvider?.id ?? "openrouter", model: b }];
  });
  const [drafts, setDrafts] = useState<Draft[]>([EMPTY, EMPTY]);
  const [fallback, setFallback] = useState<Draft>(EMPTY);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [tally, setTally] = useState<Record<string, Tally>>({});
  const [pending, start] = useTransition();

  useEffect(() => setTally(readTally()), []);

  const product = products.find((p) => p.id === productId);
  const low = rating >= 1 && rating <= 3;
  const visible = useMemo(
    () => (product?.highlights ?? []).filter((h) => h.polarity === "both" || (low ? h.polarity === "neg" : h.polarity === "pos")),
    [product, low],
  );
  const effective = picked.filter((id) => visible.some((h) => h.id === id));

  function record(results: TrainingResult[]) {
    const next = { ...readTally() };
    for (const r of results) {
      if (!r.ok) continue;
      const key = `${r.provider} · ${r.model}`;
      const t = next[key] ?? { drafts: 0, input: 0, output: 0, cost: 0, priced: 0, estimated: false };
      t.drafts += 1;
      t.input += r.usage?.input ?? 0;
      t.output += r.usage?.output ?? 0;
      if (r.usage?.costUsd != null) {
        t.cost += r.usage.costUsd;
        t.priced += 1;
        t.estimated ||= r.usage.costSource === "estimate";
      }
      next[key] = t;
    }
    setTally(next);
    try {
      sessionStorage.setItem(TALLY_KEY, JSON.stringify(next));
    } catch {}
  }

  function generate(nextVariant: number) {
    setMsg(null);
    start(async () => {
      const r = await runTraining({ productId, rating, highlightIds: effective, length, notes, language, variant: nextVariant }, cols);
      if (!r.ok) return setMsg({ tone: "error", text: r.error });
      setVariant(nextVariant);
      setDrafts(
        r.columns.map((c, i) => ({
          text: c.ok ? c.text : "",
          original: c.ok ? c.text : "",
          result: c,
          request: JSON.stringify({ model: cols[i]?.model ?? c.model, ...r.request }, null, 2),
        })),
      );
      setFallback({ text: r.fallback, original: r.fallback, result: null, request: "" });
      record(r.columns);
    });
  }

  if (products.length === 0) return <p className="text-sm text-ink-2">Add a service first, then you can train drafts here.</p>;

  const providerById = (id: string) => providers.find((p) => p.id === id);

  return (
    <div className="grid gap-8">
      {/* Setup */}
      <div className="grid gap-4 rounded border border-rule p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Service" htmlFor="tl-product">
            <Select id="tl-product" value={productId} onChange={(e) => { setProductId(e.target.value); setPicked([]); }}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Rating">
            <div role="radiogroup" aria-label="Rating" className="-ml-1 flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  className="grid size-10 place-items-center rounded transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className={cn("size-[26px] stroke-ink transition-colors", n <= rating ? "fill-ink" : "fill-none")} strokeWidth={1.3} strokeLinejoin="round">
                    <path d={STAR} />
                  </svg>
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Highlights">
          {visible.length === 0 ? (
            <p className="text-sm text-ink-3">No highlights for this rating on this service.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visible.map((h) => (
                <Chip key={h.id} on={effective.includes(h.id)} onClick={() => setPicked((p) => (p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id]))}>
                  {h.label}
                </Chip>
              ))}
            </div>
          )}
        </Field>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Length">
            <Segmented label="Length" value={length} onChange={setLength} options={[{ value: "short", label: "Short" }, { value: "detailed", label: "Detailed" }]} />
          </Field>
          <Field label="Language" htmlFor="tl-lang" className="min-w-[150px]">
            <Select id="tl-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
          <Field label="Save rules to" htmlFor="tl-scope" className="min-w-[180px]">
            <Select id="tl-scope" value={scope} onChange={(e) => setScope(e.target.value === "product" ? "product" : "brand")}>
              <option value="brand">Whole brand</option>
              <option value="product">This service only</option>
            </Select>
          </Field>
        </div>
        <Field label="Sample customer notes" htmlFor="tl-notes" hint="Optional. What this customer said about their experience.">
          <Textarea id="tl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Went live a week late, but editors love the new blocks." />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          {cols.map((c, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
              <Field label={`Model ${i === 0 ? "A" : "B"} provider`} htmlFor={`tl-prov-${i}`}>
                <Select
                  id={`tl-prov-${i}`} value={c.provider}
                  onChange={(e) => setCols((all) => all.map((x, j) => (j === i ? { provider: e.target.value, model: providerById(e.target.value)?.model ?? "" } : x)))}
                >
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.label}{p.connected ? "" : " (no key)"}</option>)}
                </Select>
              </Field>
              <Field label="Model" htmlFor={`tl-model-${i}`}>
                <Input
                  id={`tl-model-${i}`} list={`tl-models-${i}`} value={c.model} spellCheck={false} autoComplete="off" className="font-mono text-[13px]"
                  onChange={(e) => setCols((all) => all.map((x, j) => (j === i ? { ...x, model: e.target.value } : x)))}
                />
                <datalist id={`tl-models-${i}`}>{(providerById(c.provider)?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
              </Field>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => generate(0)} disabled={pending || !productId}>{pending ? "Generating…" : "Generate all"}</Button>
          <Button variant="line" onClick={() => generate(variant + 1)} disabled={pending || !fallback.text}>Generate again</Button>
          <span aria-live="polite" className="text-[13px]">
            {msg && <span className={cn("font-medium", msg.tone === "error" ? "text-danger" : "text-ok")}>{msg.text}</span>}
          </span>
        </div>
      </div>

      {/* Columns */}
      <div className="grid gap-5 lg:grid-cols-3">
        {drafts.map((d, i) => (
          <DraftColumn
            key={i}
            title={`Model ${i === 0 ? "A" : "B"}`}
            subtitle={d.result ? d.result.model : cols[i].model}
            draft={d}
            onText={(text) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, text } : x)))}
            onRequest={(request) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, request } : x)))}
            onResult={(res) => {
              setDrafts((all) => all.map((x, j) => (j === i ? { ...x, result: res, text: res.ok ? res.text : x.text, original: res.ok ? res.text : x.original } : x)));
              record([res]);
            }}
            provider={cols[i].provider} currentExtra={currentExtra}
            productId={productId} rating={rating} scope={scope} pending={pending}
            onMsg={setMsg}
          />
        ))}
        <DraftColumn
          title="Fallback"
          subtitle="Template customers get when AI is unavailable"
          draft={fallback}
          onText={(text) => setFallback((f) => ({ ...f, text }))}
          productId={productId} rating={rating} scope={scope} pending={pending}
          onMsg={setMsg}
        />
      </div>

      <UsagePanel tally={tally} onReset={() => { setTally({}); try { sessionStorage.removeItem(TALLY_KEY); } catch {} }} />
      <InspirationPanel inspirations={inspirations} productId={productId} productName={product?.name ?? ""} onChanged={() => router.refresh()} />
    </div>
  );
}

function DraftColumn({
  title, subtitle, draft, onText, onRequest, onResult, provider, currentExtra, productId, rating, scope, pending, onMsg,
}: {
  title: string;
  subtitle: string;
  draft: Draft;
  onText: (t: string) => void;
  /** Model columns only: edit the request JSON and send it. */
  onRequest?: (json: string) => void;
  onResult?: (r: TrainingResult) => void;
  provider?: string;
  currentExtra?: string;
  productId: string;
  rating: number;
  scope: "brand" | "product";
  pending: boolean;
  onMsg: (m: { tone: "error" | "ok"; text: string } | null) => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [busy, startBusy] = useTransition();
  const [dislike, setDislike] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"draft" | "request" | "response">("draft");
  const [reqErr, setReqErr] = useState("");
  const [confirmExtra, setConfirmExtra] = useState<string | null>(null);
  const r = draft.result;
  const failed = r && !r.ok;
  const words = draft.text.trim().split(/\s+/).filter(Boolean).length;
  const technical = !!onRequest;

  const send = () =>
    startBusy(async () => {
      setReqErr("");
      const res = await runRawRequest({ provider: provider ?? "", request: draft.request });
      if (!res.ok) return setReqErr(res.error);
      onResult?.(res.result);
      setTab(res.result.ok ? "draft" : "response");
    });

  /** The edited extra_instructions, or an inline error when the JSON can't be read. */
  const editedExtra = (): string | null => {
    try {
      const o = JSON.parse(draft.request) as { extra_instructions?: unknown };
      if (typeof o.extra_instructions === "string") return o.extra_instructions.trim();
      setReqErr("Add an \"extra_instructions\" text field to save it as the default.");
    } catch {
      setReqErr("Fix the JSON first.");
    }
    return null;
  };

  const saveExtra = (text: string) =>
    startBusy(async () => {
      const res = await saveDefaultExtra(text);
      if (!res.ok) return setReqErr(res.error);
      setConfirmExtra(null);
      onMsg({ tone: "ok", text: "Saved. These extra instructions now apply to every customer draft, for all clients." });
      router.refresh();
    });

  const like = () =>
    startBusy(async () => {
      const res = await saveExampleFromPlayground({ productId, rating, text: draft.text });
      if (!res.ok) return onMsg({ tone: "error", text: res.error });
      let learned = 0;
      if (draft.original && draft.original.trim() !== draft.text.trim()) learned = (await proposeFromPlayground({ productId, original: draft.original, edited: draft.text })).count;
      onMsg({ tone: "ok", text: `Liked: saved as a ${rating}★ example${learned ? `, and ${learned} rule suggestion${learned === 1 ? "" : "s"} from your edit are waiting in Brain` : ""}.` });
      router.refresh();
    });

  const saveDislike = () =>
    startBusy(async () => {
      const res = await dislikeDraft({ productId, scope, reasons, note, draft: draft.text });
      if (!res.ok) return onMsg({ tone: "error", text: res.error });
      onMsg({ tone: "ok", text: res.saved ? `Saved ${res.saved} rule${res.saved === 1 ? "" : "s"}. Generate again to see the effect.` : "Those rules already exist." });
      setDislike(false); setReasons([]); setNote("");
      router.refresh();
    });

  const never = () => {
    const el = ref.current;
    const phrase = el ? el.value.slice(el.selectionStart, el.selectionEnd) : "";
    startBusy(async () => {
      const res = await neverSay({ productId, scope, phrase });
      if (!res.ok) return onMsg({ tone: "error", text: res.error });
      onMsg({ tone: "ok", text: res.saved ? `Saved: never use "${phrase.trim()}".` : "That rule already exists." });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col rounded border border-ink bg-white">
      <div className="flex items-baseline justify-between gap-2 border-b border-rule px-4 py-2.5">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="truncate font-mono text-[11px] text-ink-3" title={subtitle}>{subtitle}</span>
      </div>
      {technical && (
        <div role="tablist" aria-label={`${title} view`} className="flex gap-1 border-b border-rule px-3 py-1.5">
          {(["draft", "request", "response"] as const).map((t) => (
            <button
              key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              disabled={t !== "draft" && !draft.request}
              className={cn("rounded px-2.5 py-1 text-[12px] font-medium capitalize disabled:opacity-40", tab === t ? "bg-ink text-white" : "text-ink-2 hover:bg-surface")}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {technical && tab === "request" && (
        <div className="grid flex-1 content-start gap-2 p-3">
          <textarea
            aria-label={`${title} request JSON, editable`}
            value={draft.request}
            spellCheck={false}
            onChange={(e) => { onRequest?.(e.target.value); if (reqErr) setReqErr(""); }}
            rows={16}
            className="block w-full resize-y rounded border border-rule bg-surface px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink outline-none focus-visible:border-carbon"
          />
          {reqErr && <p role="alert" className="text-[13px] text-danger">{reqErr}</p>}
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={send} disabled={busy || pending}>{busy ? "Sending…" : "Send this"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { const t = editedExtra(); if (t !== null) setConfirmExtra(t); }}>
              Save extra instructions as default
            </Button>
          </div>
          <p className="text-[12px] text-ink-3">Edits here are experiments: customers never get them unless you save the extra instructions as default. Keys are added on the server and never shown.</p>
          {confirmExtra !== null && (
            <div role="alertdialog" aria-label="Confirm default extra instructions" className="grid gap-2 rounded border border-warn bg-warn-wash p-3 text-[13px]">
              <p className="font-semibold">Use these extra instructions for every customer draft, for all clients?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><div className="text-ink-3">Now</div><pre className="mt-1 whitespace-pre-wrap break-words font-sans">{currentExtra?.trim() || "(none)"}</pre></div>
                <div><div className="text-ink-3">New</div><pre className="mt-1 whitespace-pre-wrap break-words font-sans">{confirmExtra || "(none)"}</pre></div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => saveExtra(confirmExtra)} disabled={busy}>Yes, save as default</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmExtra(null)} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {technical && tab === "response" && (
        <div className="grid flex-1 content-start gap-2 p-3">
          {r ? (
            <>
              <p className="text-[12px] text-ink-3">{r.ok ? usageLine(r) : r.error}</p>
              <pre aria-label={`${title} raw response`} className="max-h-[420px] overflow-auto rounded border border-rule bg-surface px-3 py-2 font-mono text-[12px] leading-[1.5]">
                {JSON.stringify(r.raw ?? null, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-sm text-ink-3">Generate or send a request to see the raw response.</p>
          )}
        </div>
      )}
      {(!technical || tab === "draft") && (<>
      <textarea
        ref={ref}
        aria-label={`${title} draft, editable`}
        value={draft.text}
        onChange={(e) => onText(e.target.value)}
        placeholder={failed ? "" : "Press Generate all."}
        rows={9}
        className={cn("block min-h-[11em] w-full flex-1 resize-y bg-transparent px-4 py-3 text-[15px] leading-[1.55] text-ink caret-carbon outline-none placeholder:text-ink-3", pending && "text-ink-2")}
      />
      {failed && <p role="alert" className="px-4 pb-2 text-[13px] text-danger">{r.error}</p>}
      <div className="border-t border-rule px-4 py-2 text-[12px] text-ink-3">
        {words} word{words === 1 ? "" : "s"}{r?.ok ? ` · ${usageLine(r)}` : ""}
      </div>
      <div className="flex flex-wrap gap-1 border-t border-rule px-3 py-2">
        <Button size="sm" variant="line" onClick={like} disabled={busy || pending || !draft.text.trim()}>👍 Like</Button>
        <Button size="sm" variant="ghost" onClick={() => setDislike((v) => !v)} disabled={busy || pending || !draft.text.trim()} aria-expanded={dislike}>👎 Dislike</Button>
        <Button size="sm" variant="ghost" onClick={never} disabled={busy || pending || !draft.text.trim()}>Never say this</Button>
      </div>
      <p className="px-4 pb-2.5 text-[12px] text-ink-3">Like saves it as an example. To ban a phrase, select it in the draft, then press Never say this.</p>
      {dislike && (
        <div className="grid gap-3 border-t border-rule px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {DISLIKE_REASONS.map((x) => (
              <Chip key={x.key} on={reasons.includes(x.key)} onClick={() => setReasons((all) => (all.includes(x.key) ? all.filter((k) => k !== x.key) : [...all, x.key]))}>
                {x.label}
              </Chip>
            ))}
          </div>
          <Input aria-label="What's wrong, in your words" placeholder="Or say what's wrong, e.g. Don't mention the price." value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <div><Button size="sm" onClick={saveDislike} disabled={busy}>Save as rules</Button></div>
        </div>
      )}
      </>)}
    </div>
  );
}

function UsagePanel({ tally, onReset }: { tally: Record<string, Tally>; onReset: () => void }) {
  const rows = Object.entries(tally);
  return (
    <div className="rounded border border-rule p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Usage this session</h2>
        {rows.length > 0 && <Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">Generate drafts to compare what each model spends.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-ink-3">
              <tr><th className="py-1 pr-4 font-normal">Model</th><th className="py-1 pr-4 font-normal">Drafts</th><th className="py-1 pr-4 font-normal">Tokens in / out</th><th className="py-1 pr-4 font-normal">Cost</th><th className="py-1 pr-4 font-normal">Avg per draft</th><th className="py-1 font-normal">Per 1,000 drafts</th></tr>
            </thead>
            <tbody>
              {rows.map(([k, t]) => {
                const avg = t.priced ? t.cost / t.priced : null;
                return (
                  <tr key={k} className="border-t border-rule">
                    <td className="py-1.5 pr-4 font-mono text-[12px]">{k}</td>
                    <td className="py-1.5 pr-4 tabular-nums">{t.drafts}</td>
                    <td className="py-1.5 pr-4 tabular-nums">{num(t.input)} / {num(t.output)}</td>
                    <td className="py-1.5 pr-4 tabular-nums">{t.priced ? `${money(t.cost)}${t.estimated ? " est." : ""}` : "unknown"}</td>
                    <td className="py-1.5 pr-4 tabular-nums">{avg == null ? "—" : money(avg)}</td>
                    <td className="py-1.5 tabular-nums">{avg == null ? "—" : money(avg * 1000)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-3">OpenRouter reports the billed cost; direct Claude and OpenAI keys are estimated from list prices. Kept in this browser tab only.</p>
    </div>
  );
}

function InspirationPanel({
  inspirations, productId, productName, onChanged,
}: { inspirations: LabInspiration[]; productId: string; productName: string; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<"brand" | "product">("brand");
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();

  const add = () =>
    start(async () => {
      setErr("");
      const r = await addInspiration({ productId, scope, text, note });
      if (!r.ok) return setErr(r.error);
      setText(""); setNote("");
      onChanged();
    });

  return (
    <div className="rounded border border-rule p-5">
      <h2 className="text-[15px] font-semibold">Inspirations</h2>
      <p className="mb-4 mt-1 text-[13px] text-ink-2">Paste writing you like, from anywhere. Drafts borrow its tone and structure, never its wording or facts. Up to 3 active ones are used per draft.</p>
      <div className="grid gap-3">
        <Textarea aria-label="Writing you like" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a review, post or email whose style you'd like drafts to have." />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-end">
          <Field label="What you like about it" htmlFor="insp-note">
            <Input id="insp-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Short sentences, names one concrete result." />
          </Field>
          <Field label="Use for" htmlFor="insp-scope">
            <Select id="insp-scope" value={scope} onChange={(e) => setScope(e.target.value === "product" ? "product" : "brand")}>
              <option value="brand">Whole brand</option>
              <option value="product">{productName ? `${productName} only` : "This service only"}</option>
            </Select>
          </Field>
          <Button onClick={add} disabled={busy || !text.trim()}>Add inspiration</Button>
        </div>
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
      </div>
      {inspirations.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {inspirations.map((i) => (
            <li key={i.id} className={cn("grid gap-1 rounded border border-rule px-3 py-2.5 text-sm", !i.active && "opacity-60")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[12px] text-ink-3">{i.scope ?? "Whole brand"}{i.active ? "" : " · off"}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => { await setInspirationActive(i.id, !i.active); onChanged(); })}>{i.active ? "Turn off" : "Turn on"}</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => { await deleteInspiration(i.id); onChanged(); })}>Delete</Button>
                </span>
              </div>
              {i.note && <span className="font-medium">{i.note}</span>}
              <span className="line-clamp-3 text-ink-2">{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
