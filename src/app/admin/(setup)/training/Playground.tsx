"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Chip, Field, Select, Segmented, Textarea, cn } from "@/components/ui";
import Link from "next/link";
import { runPreview, saveExampleFromPlayground } from "./actions";
import { proposeFromPlayground } from "../memory/actions";

type Polarity = "pos" | "neg" | "both";
export type PlayProduct = { id: string; name: string; highlights: { id: string; label: string; polarity: Polarity }[] };

const STAR = "M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.27 6.38L12 17.05 6.31 20.23l1.27-6.38L2.8 9.45l6.45-.75z";

export function Playground({
  products, languages, defaultLanguage,
}: { products: PlayProduct[]; languages: readonly { value: string; label: string }[]; defaultLanguage: string }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [rating, setRating] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [length, setLength] = useState<"short" | "detailed">("short");
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [variant, setVariant] = useState(0);
  const [text, setText] = useState("");
  const [model, setModel] = useState("");
  const [original, setOriginal] = useState("");
  const [proposed, setProposed] = useState(0);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const product = products.find((p) => p.id === productId);
  const low = rating >= 1 && rating <= 3;
  const visible = useMemo(
    () => (product?.highlights ?? []).filter((h) => h.polarity === "both" || (low ? h.polarity === "neg" : h.polarity === "pos")),
    [product, low],
  );
  const effective = picked.filter((id) => visible.some((h) => h.id === id));
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const generate = (nextVariant: number) => {
    setMsg(null);
    start(async () => {
      const r = await runPreview({ productId, rating, highlightIds: effective, length, notes, language, variant: nextVariant });
      if (r.ok) { setOriginal(r.text); setProposed(0); setText(r.text); setModel(r.model); setVariant(nextVariant); }
      else setMsg({ tone: "error", text: r.error });
    });
  };

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await saveExampleFromPlayground({ productId, rating, text });
      setMsg(r.ok ? { tone: "ok", text: "Saved to the examples library." } : { tone: "error", text: r.error });
      if (r.ok && original && original.trim() !== text.trim()) {
        const p = await proposeFromPlayground({ productId, original, edited: text });
        setProposed(p.count);
      }
    });
  };

  if (products.length === 0) return <p className="text-sm text-ink-2">Add a product first, then you can try drafts here.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-4">
        {products.length > 1 && <Field label="Product" htmlFor="pg-product">
          <Select id="pg-product" value={productId} onChange={(e) => { setProductId(e.target.value); setPicked([]); }}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>}

        <Field label="Rating">
          <div role="radiogroup" aria-label="Rating" className="-ml-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(rating === n ? 0 : n)}
                className="grid size-10 place-items-center rounded transition-transform duration-200 hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 24 24" aria-hidden className={cn("size-[28px] stroke-ink transition-colors", n <= rating ? "fill-ink" : "fill-none")} strokeWidth={1.3} strokeLinejoin="round">
                  <path d={STAR} />
                </svg>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Highlights" hint={rating === 0 ? "Showing positive chips. Pick a rating of 3 or below to see negative ones." : undefined}>
          {visible.length === 0 ? (
            <p className="text-sm text-ink-3">No highlights for this rating on this product.</p>
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
          <Field label="Language" htmlFor="pg-lang" className="min-w-[150px] flex-1">
            <Select id="pg-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Sample customer notes" htmlFor="pg-notes" hint="Optional.">
          <Textarea id="pg-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bought it last month, uses it daily, delivery was quick." />
        </Field>

        <div>
          <Button onClick={() => generate(0)} disabled={pending || !productId}>{pending && !text ? "Generating..." : "Generate"}</Button>
        </div>
      </div>

      <div>
        <div className="relative pb-0 pl-0 pr-[10px] pt-[10px]">
          <div aria-hidden className="absolute bottom-0 left-[10px] right-0 top-[22px] -z-0 rounded border border-carbon bg-wash" />
          <div className="relative rounded border border-ink bg-white px-[18px] pb-3.5 pt-4 focus-within:shadow-[0_0_0_3px_var(--color-wash)]">
            <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.08em] text-ink-3">
              <span>NO. 0000 · PREVIEW</span>
              <span>{model ? (model === "demo" ? "MODEL: DEMO (NO API KEY)" : `MODEL: ${model.toUpperCase()}`) : "NOT GENERATED"}</span>
            </div>
            <textarea
              aria-label="Generated draft, editable"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pick a product and rating, then Generate. You can edit the draft here before saving it as an example."
              rows={8}
              className={cn("block min-h-[9em] w-full resize-y bg-transparent text-[17px] leading-[1.55] text-ink caret-carbon outline-none transition-colors placeholder:text-ink-3", pending && "text-ink-2")}
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2.5 text-[13px] text-ink-3">
              <span>{words} word{words === 1 ? "" : "s"}{variant > 0 ? ` · variant ${variant + 1}` : ""}</span>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => generate(variant + 1)} disabled={pending || !text}>Generate again</Button>
                <Button variant="line" size="sm" onClick={save} disabled={pending || !text.trim()}>Save as example</Button>
              </span>
            </div>
          </div>
        </div>
        <div aria-live="polite" className="mt-4 min-h-5 text-[13px]">
          {msg && <span className={cn("font-medium", msg.tone === "error" ? "text-danger" : "text-ok")}>{msg.text}</span>}
          {proposed > 0 && (
            <span className="ml-3">Proposed {proposed} memor{proposed === 1 ? "y" : "ies"} <Link href="/admin/memory#waiting" className="font-medium text-carbon underline underline-offset-2">review</Link></span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-3">Edit the text until it sounds right, then save it. Saved examples teach the model tone and structure.</p>
      </div>
    </div>
  );
}
