"use client";

import { useState } from "react";
import { Button, Input, Segmented, Icons } from "@/components/ui";

type Polarity = "pos" | "neg" | "both";
type Item = { key: string; id?: string; label: string; labelJa: string; polarity: Polarity };

const POL = [
  { value: "pos" as const, label: "Positive" },
  { value: "neg" as const, label: "Negative" },
  { value: "both" as const, label: "Both" },
];

export function HighlightEditor({ initial, showJa = false }: { initial: { id: string; label: string; labelJa: string; polarity: Polarity }[]; showJa?: boolean }) {
  const [items, setItems] = useState<Item[]>(() => initial.map((h) => ({ key: h.id, ...h })));
  const [label, setLabel] = useState("");
  const [pol, setPol] = useState<Polarity>("pos");

  const add = () => {
    const l = label.trim();
    if (!l) return;
    setItems((xs) => [...xs, { key: crypto.randomUUID(), label: l, labelJa: "", polarity: pol }]);
    setLabel("");
  };
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const setPolarity = (i: number, p: Polarity) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, polarity: p } : x)));
  const setJa = (i: number, v: string) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, labelJa: v } : x)));
  const remove = (i: number) => setItems((xs) => xs.filter((_, k) => k !== i));

  return (
    <div className="grid gap-3">
      <input type="hidden" name="highlights" value={JSON.stringify(items.map(({ id, label, labelJa, polarity }) => ({ id, label, labelJa, polarity })))} />
      {items.length === 0 && <p className="text-sm text-ink-3">No highlights yet.</p>}
      <ul className="grid gap-2">
        {items.map((h, i) => (
          <li key={h.key} className="flex flex-wrap items-center gap-2 rounded border border-rule px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{h.label}</span>
            {showJa && (
              <Input
                lang="ja"
                value={h.labelJa}
                onChange={(e) => setJa(i, e.target.value)}
                placeholder="日本語ラベル"
                aria-label={`Japanese label for ${h.label}`}
                maxLength={40}
                className="h-9 w-40 text-[13px]"
              />
            )}
            <Segmented label={`Polarity of ${h.label}`} options={POL} value={h.polarity} onChange={(p) => setPolarity(i, p)} />
            <span className="flex">
              <Button variant="ghost" size="sm" aria-label={`Move ${h.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
              <Button variant="ghost" size="sm" aria-label={`Move ${h.label} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</Button>
              <Button variant="ghost" size="sm" aria-label={`Remove ${h.label}`} onClick={() => remove(i)}><Icons.X size={14} aria-hidden /></Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add a highlight, e.g. Easy to set up"
          aria-label="New highlight label"
          maxLength={60}
          className="min-w-[200px] flex-1"
        />
        <Segmented label="New highlight polarity" options={POL} value={pol} onChange={setPol} />
        <Button variant="line" onClick={add}><Icons.Plus size={16} aria-hidden /> Add</Button>
      </div>
    </div>
  );
}
