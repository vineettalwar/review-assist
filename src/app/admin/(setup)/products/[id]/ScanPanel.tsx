"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Input, Field, Pill, Note } from "@/components/ui";
import { scanProductUrl, applyProductScan, type ScanProposal } from "../scan-actions";

type Pol = "pos" | "neg" | "both";
const POL_LABEL: Record<Pol, string> = { pos: "Positive", neg: "Negative", both: "Both" };

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-[var(--color-carbon)]" />
      <label htmlFor={id} className="flex-1 text-sm">{children}</label>
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded border border-rule p-4">
      <legend className="px-1 text-[13px] font-medium text-ink-2">{title}</legend>
      <ul className="space-y-1.5">{children}</ul>
    </fieldset>
  );
}

export function ScanPanel({ productId, initialUrl }: { productId: string; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [scanning, startScan] = useTransition();
  const [applying, startApply] = useTransition();
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<ScanProposal | null>(null);
  // Unticked keys; everything starts ticked.
  const [off, setOff] = useState<Set<string>>(new Set());

  const toggle = (k: string, on: boolean) =>
    setOff((s) => {
      const n = new Set(s);
      if (on) n.delete(k);
      else n.add(k);
      return n;
    });

  const scan = () => {
    setError("");
    setProposal(null);
    setOff(new Set());
    startScan(async () => {
      try {
        const r = await scanProductUrl(productId, url);
        if (r.ok) setProposal(r.proposal);
        else setError(r.error);
      } catch {
        setError("Couldn't reach the server. Reload the page and try again.");
      }
    });
  };

  const p = proposal;
  const ctxKeys = [
    ["audience", "Who it's for", "u"],
    ["experience", "Customer journey", "e"],
    ["praise", "Often praised", "p"],
    ["concerns", "Sometimes raised", "c"],
  ] as const;
  const total = p ? (p.category ? 1 : 0) + p.knowledge.length + p.highlights.length + p.avoid.length + p.memories.length + ctxKeys.reduce((n, [k]) => n + p[k].length, 0) : 0;
  const picked = p
    ? {
        url: p.url,
        category: p.category && !off.has("cat") ? p.category : "",
        knowledge: p.knowledge.filter((_, i) => !off.has(`k${i}`)),
        audience: p.audience.filter((_, i) => !off.has(`u${i}`)),
        experience: p.experience.filter((_, i) => !off.has(`e${i}`)),
        praise: p.praise.filter((_, i) => !off.has(`p${i}`)),
        concerns: p.concerns.filter((_, i) => !off.has(`c${i}`)),
        avoid: p.avoid.filter((_, i) => !off.has(`a${i}`)),
        highlights: p.highlights.filter((_, i) => !off.has(`h${i}`)),
        memories: p.memories.filter((_, i) => !off.has(`m${i}`)),
      }
    : null;
  const count = picked
    ? (picked.category ? 1 : 0) + picked.knowledge.length + picked.avoid.length + picked.highlights.length + picked.memories.length +
      picked.audience.length + picked.experience.length + picked.praise.length + picked.concerns.length
    : 0;

  // The action redirects on success, so the transition simply ends with navigation.
  const add = () => {
    if (!picked) return;
    startApply(async () => {
      await applyProductScan(productId, picked);
    });
  };

  return (
    <div className="max-w-[760px]">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Product page URL" htmlFor="scan-url"  className="min-w-[260px] flex-1">
          <Input
            id="scan-url"
            type="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (url.trim() && !scanning) scan(); } }}
          />
        </Field>
        <Button variant="line" onClick={scan} disabled={scanning || applying || !url.trim()}>{scanning ? "Scanning the page…" : "Scan page"}</Button>
      </div>

      <div aria-live="polite" className="mt-4">
        {scanning && <p className="text-sm text-ink-2">Scanning the page… this can take several seconds.</p>}
        {error && <Note className="mb-0 border-danger bg-danger-wash">{error}</Note>}
        {p && (
          <div className="grid gap-3">
            <div className="rounded border border-carbon bg-wash px-4 py-3 text-[13px] text-ink-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={p.mode === "ai" ? "blue" : "neutral"}>{p.mode === "ai" ? "AI" : "Basic"}</Pill>
                <span>
                  {p.mode === "ai" ? (
                    "Read the page. Untick anything you don't want."
                  ) : (
                    <>Basic scan: the page description and a few factual lines, copied as written. Connect an AI provider in <Link href="/admin/settings" className="underline underline-offset-2">Settings</Link> to learn full product details.</>
                  )}
                </span>
              </div>
              {p.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-warn">
                  {p.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>

            {total === 0 ? (
              <p className="text-sm text-ink-2">Nothing new found on that page.</p>
            ) : (
              <>
                {p.category && (
                  <Group title="Category">
                    <Check id="s-cat" checked={!off.has("cat")} onChange={(v) => toggle("cat", v)}>{p.category}</Check>
                  </Group>
                )}
                {p.knowledge.length > 0 && (
                  <Group title="Facts">
                    {p.knowledge.map((t, i) => <Check key={i} id={`s-k${i}`} checked={!off.has(`k${i}`)} onChange={(v) => toggle(`k${i}`, v)}>{t}</Check>)}
                  </Group>
                )}
                {ctxKeys.map(([k, title, pre]) =>
                  p[k].length > 0 ? (
                    <Group key={k} title={title}>
                      {p[k].map((t, i) => <Check key={i} id={`s-${pre}${i}`} checked={!off.has(`${pre}${i}`)} onChange={(v) => toggle(`${pre}${i}`, v)}>{t}</Check>)}
                    </Group>
                  ) : null,
                )}
                {p.highlights.length > 0 && (
                  <Group title="Highlight chips">
                    {p.highlights.map((h, i) => (
                      <Check key={i} id={`s-h${i}`} checked={!off.has(`h${i}`)} onChange={(v) => toggle(`h${i}`, v)}>
                        {h.label} <Pill className="ml-1.5">{POL_LABEL[h.polarity]}</Pill>
                      </Check>
                    ))}
                  </Group>
                )}
                {p.avoid.length > 0 && (
                  <Group title="Avoid">
                    {p.avoid.map((t, i) => <Check key={i} id={`s-a${i}`} checked={!off.has(`a${i}`)} onChange={(v) => toggle(`a${i}`, v)}>{t}</Check>)}
                  </Group>
                )}
                {p.memories.length > 0 && (
                  <Group title="Memory suggestions">
                    {p.memories.map((m, i) => (
                      <Check key={i} id={`s-m${i}`} checked={!off.has(`m${i}`)} onChange={(v) => toggle(`m${i}`, v)}>
                        <Pill tone={m.kind === "avoid" ? "amber" : "blue"} className="mr-2 capitalize">{m.kind}</Pill>{m.text}
                      </Check>
                    ))}
                  </Group>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={add} disabled={applying || count === 0}>{applying ? "Adding…" : `Add selected (${count})`}</Button>
                  {p.memories.length > 0 && <span className="text-xs text-ink-3">Memory suggestions are saved as proposed for you to approve.</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
