"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Lock, Check, X } from "lucide-react";
import { Button, Chip, Field, Input, Note, Pill, Segmented, Select, Textarea, cn } from "@/components/ui";
import { createBrandFromOnboarding, importAction, sampleAction, saveExampleAction } from "./actions";
import type { PrefillResult } from "@/lib/prefill";
import type { SuggestedPortal } from "@/lib/prefill/discover";
import type { DraftBrand, DraftHighlight, DraftMemory, DraftPortal, DraftProduct, MemKind, PortalType, Polarity, SavedProduct, Voice } from "./types";

const STEPS = ["Brand", "Products", "Portals", "Test"] as const; // indicator labels; step 0 (start) and 1 (brand) share "Brand"
const VOICES: { value: Voice; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "brief", label: "Brief" },
];
const LANGS = [
  ["en", "English"],
  ["ja", "Japanese"],
];
const PORTAL_TYPES: { type: PortalType; label: string; ph: string }[] = [
  { type: "google", label: "Google", ph: "https://g.page/r/your-place/review" },
  { type: "trustpilot", label: "Trustpilot", ph: "https://www.trustpilot.com/evaluate/example.com" },
  { type: "amazon", label: "Amazon", ph: "https://www.amazon.com/review/create-review?asin=..." },
  { type: "yelp", label: "Yelp", ph: "https://www.yelp.com/writeareview/biz/..." },
  { type: "facebook", label: "Facebook", ph: "https://www.facebook.com/yourpage/reviews" },
  { type: "g2", label: "G2", ph: "https://www.g2.com/products/your-product/take_survey" },
  { type: "custom", label: "Custom", ph: "https://example.com/reviews" },
];
const KIND_TONE = { fact: "blue", style: "green", avoid: "amber" } as const;

let seq = 0;
const k = () => `k${++seq}`;
const blankProduct = (): DraftProduct => ({ key: k(), name: "", category: "", url: "", knowledge: "", avoid: "", highlights: [], memories: [] });
const isHttps = (u: string) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

// The action request itself failed: usually the dev server restarted or the app was redeployed under an open page.
const OFFLINE = "Couldn't reach the server. Reload the page and try again. What you typed here isn't saved yet.";

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 start, 1 brand, 2 products, 3 portals, 4 test
  const [brand, setBrand] = useState<DraftBrand>({ name: "", website: "", about: "", audience: "", facts: "", voice: "warm", voiceNotes: "", wordsToAvoid: "", defaultLanguage: "en" });
  const [productUrls, setProductUrls] = useState<string[]>([]);
  // Kept as typed text so the field can be cleared mid-edit; clamped to 2–30 when used and on blur.
  const [pagesText, setPagesText] = useState("8");
  const pages = Math.max(2, Math.min(30, Math.round(Number(pagesText) || 8)));
  const [products, setProducts] = useState<DraftProduct[]>([blankProduct()]);
  const [brandMems, setBrandMems] = useState<DraftMemory[]>([]);
  const [portals, setPortals] = useState<DraftPortal[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string>("");
  const [prefill, setPrefill] = useState<{ mode: "ai" | "basic"; warnings: string[]; sources: string[] } | null>(null);
  const [busy, setBusy] = useState<"" | "prefill" | "save">("");
  const [saved, setSaved] = useState<{ brandId: string; products: SavedProduct[]; warning?: string } | null>(null);

  // After save there is no Back: the test step has no Back button and the stepper isn't clickable, so no duplicate saves.
  const stepIdx = step === 0 ? 0 : step - 1 > 3 ? 3 : step - 1; // indicator index
  const patchBrand = (p: Partial<DraftBrand>) => setBrand((b) => ({ ...b, ...p }));

  async function runImport() {
    const e: Record<string, string> = {};
    if (!isHttps(brand.website.trim())) e.website = "Enter the website as a full https:// address.";
    productUrls.forEach((u, i) => {
      if (u.trim() && !isHttps(u.trim())) e[`pu${i}`] = "Use a full https:// address.";
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy("prefill");
    setBanner("");
    const r = await importAction({ website: brand.website.trim(), pages, extraUrls: productUrls.filter((u) => u.trim()) }).catch(() => null);
    setBusy("");
    if (!r || !r.ok) {
      setBanner(r?.error || OFFLINE);
      return;
    }
    applyPrefill(r.result, r.result.portals);
    setStep(1);
  }

  function applyPrefill(res: PrefillResult, found: SuggestedPortal[] = []) {
    setBrand((b) => ({ ...b, ...res.brand, name: b.name.trim() || res.brand.name?.trim() || "" }));
    if (found.length) setPortals(found.map((p) => ({ key: k(), type: p.type, label: p.label, url: p.url })));
    const toMem = (m: { kind: MemKind; text: string }): DraftMemory => ({ key: k(), kind: m.kind, text: m.text, checked: true });
    const ps: DraftProduct[] = res.products.map((p, i) => ({
      key: k(),
      name: p.name,
      category: p.category,
      url: p.url,
      knowledge: p.knowledge,
      avoid: p.avoid,
      audience: p.audience,
      experience: p.experience,
      praise: p.praise,
      concerns: p.concerns,
      highlights: p.highlights.map((h) => ({ label: h.label, polarity: h.polarity })),
      memories: res.memories.filter((m) => m.productIndex === i).map(toMem),
    }));
    setProducts(ps.length ? ps : [blankProduct()]);
    setBrandMems(res.memories.filter((m) => m.productIndex === null || m.productIndex >= ps.length || m.productIndex < 0).map(toMem));
    setPrefill({ mode: res.mode, warnings: res.warnings, sources: res.sources });
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0 || s === 1) {
      if (!brand.name.trim()) e.name = "Brand name is required.";
      if (brand.website.trim() && !isHttps(brand.website.trim())) e.website = "Use a full https:// address.";
    }
    if (s === 2) {
      if (!products.some((p) => p.name.trim())) e.products = "Add at least one product with a name.";
      products.forEach((p) => {
        if (p.url.trim() && !isHttps(p.url.trim())) e[`p${p.key}`] = "Use a full https:// address.";
      });
    }
    if (s === 3) {
      portals.forEach((p) => {
        const placeId = p.type === "google" && /^[A-Za-z0-9_-]{20,300}$/.test(p.url.trim());
        if (!placeId && !isHttps(p.url.trim())) e[`pt${p.key}`] = p.type === "google" ? "Enter a Place ID or a Google review link." : "A full https:// link is required.";
        if (p.type === "custom" && !p.label.trim()) e[`pl${p.key}`] = "Give it a name.";
      });
    }
    setErrors(e);
    return !Object.keys(e).length;
  }

  function next() {
    if (!validate(step)) return;
    setBanner("");
    if (step === 3) void save();
    else setStep(step + 1);
  }

  async function save() {
    setBusy("save");
    const payload = {
      brandId: saved?.brandId,
      brand,
      brandMemories: brandMems.filter((m) => m.checked && m.text.trim()).map((m) => ({ kind: m.kind, text: m.text })),
      products: products
        .filter((p) => p.name.trim())
        .map((p) => ({ ...p, memories: p.memories.filter((m) => m.checked && m.text.trim()).map((m) => ({ kind: m.kind, text: m.text })) })),
      portals: portals.map((p) => ({ type: p.type, label: p.label, url: p.url })),
    };
    const r = await createBrandFromOnboarding(payload).catch(() => null);
    setBusy("");
    if (!r || !r.ok) {
      setBanner(r?.error || OFFLINE);
      if (r && !r.ok) {
        if (r.field === "brand") setStep(1);
        if (r.field === "products") setStep(2);
        if (r.field === "portals") setStep(3);
      }
      return;
    }
    setSaved({ brandId: r.brandId, products: r.products, warning: r.warning });
    setStep(4);
  }

  return (
    <div className="max-w-[820px]">
      <div className="mb-8 border-b border-ink pb-6">
        <h1 className="text-[clamp(34px,4.2vw,44px)] font-bold leading-[1.03] tracking-[-0.035em] [text-wrap:balance]">
          {step === 0 ? "Set up a new brand" : STEPS[stepIdx] === "Test" ? "Try a sample review" : `${STEPS[stepIdx]} details`}
        </h1>
        <p className="mt-2.5 max-w-[60ch] text-base text-ink-2">
          {step === 0 && "Tell us who you are. We can read your website to draft the rest, and you review everything before it's saved."}
          {step === 1 && "How should reviews for this brand sound?"}
          {step === 2 && "What do customers review? The AI only uses facts you give it here."}
          {step === 3 && "Where should customers post their review?"}
          {step === 4 && "Your brand is saved. Generate a sample to see how it reads."}
        </p>
      </div>

      <ol aria-label="Progress" className="mb-8 flex gap-6 overflow-x-auto text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === stepIdx ? "step" : undefined}
            className={cn("whitespace-nowrap border-b-2 pb-1.5 font-medium", i === stepIdx ? "border-ink text-ink" : "border-transparent text-ink-3")}
          >
            {i < stepIdx && <Check size={13} aria-hidden className="mr-1 inline -translate-y-px" />}
            {s}
          </li>
        ))}
      </ol>

      {banner && (
        <div role="alert" className="mb-5 rounded border border-danger bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {banner}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-5">
          <Field label="Website" htmlFor="ob-web" error={errors.website} hint="We find the service and about pages ourselves and draft everything. You review it all before anything is saved.">
            <Input id="ob-web" type="url" inputMode="url" value={brand.website} onChange={(e) => patchBrand({ website: e.target.value })} aria-invalid={!!errors.website} placeholder="https://client-website.com" />
          </Field>
          <div className="grid gap-5 min-[560px]:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="Brand name (optional)" htmlFor="ob-name" error={errors.name} hint="Taken from the site if left empty.">
              <Input id="ob-name" value={brand.name} onChange={(e) => patchBrand({ name: e.target.value })} aria-invalid={!!errors.name} placeholder="Client name" />
            </Field>
            <Field label="Pages to read" htmlFor="ob-pages" hint="2 to 30. About 1 cent per 4 pages.">
              <Input
                id="ob-pages" type="number" inputMode="numeric" min={2} max={30} value={pagesText}
                onChange={(e) => setPagesText(e.target.value)}
                onBlur={() => setPagesText(String(pages))}
              />
            </Field>
          </div>
          <details className="group" open={productUrls.length > 0}>
            <summary className="cursor-pointer text-[13px] font-medium text-carbon">Add specific pages (optional)</summary>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Service or product pages to read first (up to 10)</legend>
            <div className="space-y-2">
              {productUrls.map((u, i) => (
                <div key={i}>
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Product page ${i + 1}`}
                      type="url"
                      inputMode="url"
                      value={u}
                      aria-invalid={!!errors[`pu${i}`]}
                      placeholder="https://yourbrand.com/product"
                      onChange={(e) => setProductUrls((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <Button variant="ghost" aria-label={`Remove product page ${i + 1}`} onClick={() => setProductUrls((a) => a.filter((_, j) => j !== i))}>
                      <X size={16} aria-hidden />
                    </Button>
                  </div>
                  {errors[`pu${i}`] && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors[`pu${i}`]}</p>}
                </div>
              ))}
            </div>
            {productUrls.length < 10 && (
              <Button variant="line" size="sm" className="mt-2" onClick={() => setProductUrls((a) => [...a, ""])}>
                <Plus size={14} aria-hidden /> Add a page
              </Button>
            )}
          </fieldset>
          </details>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={runImport} disabled={busy === "prefill"}>
              {busy === "prefill" ? "Reading the site…" : "Import from website"}
            </Button>
            <Button
              variant="line"
              disabled={busy === "prefill"}
              onClick={() => {
                if (validate(0)) setStep(1);
              }}
            >
              Fill in by hand
            </Button>
            <span role="status" aria-live="polite" className="text-sm text-ink-3">
              {busy === "prefill" && `Reading up to ${pages} pages. This can take up to a minute. Nothing is saved yet.`}
            </span>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          {prefill && <PrefillNote p={prefill} />}
          <Field label="Brand name" htmlFor="b-name" error={errors.name}>
            <Input id="b-name" value={brand.name} onChange={(e) => patchBrand({ name: e.target.value })} aria-invalid={!!errors.name} />
          </Field>
          <Field label="About" htmlFor="b-about" hint="Two or three sentences about the business.">
            <Textarea id="b-about" value={brand.about} onChange={(e) => patchBrand({ about: e.target.value })} />
          </Field>
          <Field label="Who are the customers?" htmlFor="b-aud" hint="e.g. Marketing teams at B2B companies with a WordPress site.">
            <Textarea id="b-aud" rows={2} value={brand.audience} onChange={(e) => patchBrand({ audience: e.target.value })} />
          </Field>
          <Field label="Brand facts" htmlFor="b-facts" hint="Short facts drafts may use, one per line: years in business, locations, response times.">
            <Textarea id="b-facts" rows={3} value={brand.facts} onChange={(e) => patchBrand({ facts: e.target.value })} />
          </Field>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-2" id="voice-l">Voice</div>
            <div role="group" aria-labelledby="voice-l" className="flex flex-wrap gap-2">
              {VOICES.map((v) => (
                <Chip key={v.value} on={brand.voice === v.value} onClick={() => patchBrand({ voice: v.value })}>{v.label}</Chip>
              ))}
            </div>
          </div>
          <Field label="Voice notes" htmlFor="b-vn" hint="e.g. friendly but never gushing; mention the team by role, not name.">
            <Textarea id="b-vn" value={brand.voiceNotes} onChange={(e) => patchBrand({ voiceNotes: e.target.value })} />
          </Field>
          <Field label="Words to avoid" htmlFor="b-wa" hint="Comma separated.">
            <Input id="b-wa" value={brand.wordsToAvoid} onChange={(e) => patchBrand({ wordsToAvoid: e.target.value })} />
          </Field>
          <Field label="Default language" htmlFor="b-lang" className="max-w-[240px]">
            <Select id="b-lang" value={brand.defaultLanguage} onChange={(e) => patchBrand({ defaultLanguage: e.target.value })}>
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <MemoryList title="Remembered about the brand" items={brandMems} onChange={setBrandMems} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {errors.products && <p role="alert" className="text-sm font-medium text-danger">{errors.products}</p>}
          {products.map((p, i) => (
            <ProductCard
              key={p.key}
              p={p}
              index={i}
              error={errors[`p${p.key}`]}
              canRemove={products.length > 1}
              onChange={(np) => setProducts((a) => a.map((x) => (x.key === p.key ? np : x)))}
              onRemove={() => setProducts((a) => a.filter((x) => x.key !== p.key))}
            />
          ))}
          <Button variant="line" onClick={() => setProducts((a) => [...a, blankProduct()])}>
            <Plus size={14} aria-hidden /> Add a product
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Note icon={<Lock size={16} aria-hidden />}>
            Locked types (Google, Trustpilot, Amazon, Yelp, Facebook) never allow rewards for reviews. You can add or change portals any time later.
          </Note>
          {portals.length === 0 && <p className="text-sm text-ink-3">No portals yet. You can skip this and add them later.</p>}
          {portals.map((p) => {
            const meta = PORTAL_TYPES.find((t) => t.type === p.type)!;
            return (
              <div key={p.key} className="rounded border border-rule p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <Button variant="ghost" size="sm" aria-label={`Remove ${meta.label} portal`} onClick={() => setPortals((a) => a.filter((x) => x.key !== p.key))}>
                    <Trash2 size={14} aria-hidden /> Remove
                  </Button>
                </div>
                <div className="grid gap-3 min-[700px]:grid-cols-[1fr_2fr]">
                  <Field label="Name shown to customers" htmlFor={`pl-${p.key}`} error={errors[`pl${p.key}`]}>
                    <Input id={`pl-${p.key}`} value={p.label} aria-invalid={!!errors[`pl${p.key}`]} onChange={(e) => setPortals((a) => a.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)))} />
                  </Field>
                  <Field label={p.type === "google" ? "Place ID or review link" : "Review page link"} htmlFor={`pu-${p.key}`} error={errors[`pt${p.key}`]}>
                    <Input id={`pu-${p.key}`} type={p.type === "google" ? "text" : "url"} inputMode="url" value={p.url} placeholder={p.type === "google" ? "ChIJ… or https://g.page/r/…/review" : meta.ph} aria-invalid={!!errors[`pt${p.key}`]} onChange={(e) => setPortals((a) => a.map((x) => (x.key === p.key ? { ...x, url: e.target.value } : x)))} />
                  </Field>
                </div>
              </div>
            );
          })}
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-2">Add a portal</div>
            <div className="flex flex-wrap gap-2">
              {PORTAL_TYPES.map((t) => (
                <Chip key={t.type} onClick={() => setPortals((a) => [...a, { key: k(), type: t.type, label: t.type === "custom" ? "" : t.label, url: "" }])}>
                  <Plus size={12} aria-hidden className="mr-1 inline -translate-y-px" />
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-3">The first portal is the default for new links.</p>
        </div>
      )}

      {step === 4 && saved && <TestStep saved={saved} onFinish={() => { router.push("/admin/links"); router.refresh(); }} />}

      {step < 4 && step > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
          <Button variant="line" onClick={() => setStep(step - 1)} disabled={busy === "save"}>Back</Button>
          <Button onClick={next} disabled={busy === "save"}>
            {busy === "save" ? "Saving…" : step === 3 ? "Save and test" : "Continue"}
          </Button>
          {step === 3 && <span className="text-xs text-ink-3">Saving creates the brand. After that, edit details under Brand and Products.</span>}
        </div>
      )}
    </div>
  );
}

function PrefillNote({ p }: { p: { mode: "ai" | "basic"; warnings: string[]; sources: string[] } }) {
  const n = p.sources.length;
  return (
    <div className="rounded border border-carbon bg-wash px-4 py-3 text-[13px] text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={p.mode === "ai" ? "blue" : "neutral"}>{p.mode === "ai" ? "AI" : "Basic"}</Pill>
        <span>
          {p.mode === "ai"
            ? `Drafted from ${n} page${n === 1 ? "" : "s"}. Check every field: it's the client's brand.`
            : "Basic prefill from page descriptions and a few factual lines (no AI provider connected, or the model failed). Fill in the gaps by hand."}
        </span>
      </div>
      {n > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-carbon">Pages read</summary>
          <ul className="mt-1 list-disc pl-5">
            {p.sources.map((s) => <li key={s} className="break-all">{s.replace(/^https:\/\//, "")}</li>)}
          </ul>
        </details>
      )}
      {p.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-warn">
          {p.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MemoryList({ title, items, onChange }: { title: string; items: DraftMemory[]; onChange: (m: DraftMemory[]) => void }) {
  if (!items.length) return null;
  return (
    <fieldset className="rounded border border-rule p-4">
      <legend className="px-1 text-[13px] font-medium text-ink-2">{title}</legend>
      <p className="mb-2 text-xs text-ink-3">Short notes the AI will remember. Untick any you don&apos;t want.</p>
      <ul className="space-y-1.5">
        {items.map((m) => (
          <li key={m.key} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id={`m-${m.key}`}
              checked={m.checked}
              className="mt-1 size-4 accent-[var(--color-ink)]"
              onChange={(e) => onChange(items.map((x) => (x.key === m.key ? { ...x, checked: e.target.checked } : x)))}
            />
            <label htmlFor={`m-${m.key}`} className="flex-1 text-sm">
              <Pill tone={KIND_TONE[m.kind]} className="mr-2 capitalize">{m.kind}</Pill>
              {m.text}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function ProductCard({
  p, index, error, canRemove, onChange, onRemove,
}: { p: DraftProduct; index: number; error?: string; canRemove: boolean; onChange: (p: DraftProduct) => void; onRemove: () => void }) {
  const [label, setLabel] = useState("");
  const [pol, setPol] = useState<Polarity>("pos");
  const set = (x: Partial<DraftProduct>) => onChange({ ...p, ...x });
  const addH = () => {
    const l = label.trim();
    if (!l) return;
    set({ highlights: [...p.highlights, { label: l, polarity: pol }] });
    setLabel("");
  };
  const id = (s: string) => `${s}-${p.key}`;
  return (
    <section aria-label={`Product ${index + 1}`} className="rounded border border-ink p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg tracking-[-0.02em]">{p.name.trim() || `Product ${index + 1}`}</h2>
        {canRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove product ${index + 1}`}>
            <Trash2 size={14} aria-hidden /> Remove
          </Button>
        )}
      </div>
      <div className="grid gap-4 min-[700px]:grid-cols-2">
        <Field label="Name" htmlFor={id("n")}>
          <Input id={id("n")} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Category" htmlFor={id("c")}>
          <Input id={id("c")} value={p.category} onChange={(e) => set({ category: e.target.value })} />
        </Field>
      </div>
      <Field label="Product page (optional)" htmlFor={id("u")} error={error} className="mt-4">
        <Input id={id("u")} type="url" inputMode="url" value={p.url} placeholder="https://yourbrand.com/product" aria-invalid={!!error} onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <Field label="Knowledge" htmlFor={id("k")} className="mt-4" hint="The AI only uses these facts. Leave out anything you wouldn't want a customer to say.">
        <Textarea id={id("k")} rows={5} value={p.knowledge} onChange={(e) => set({ knowledge: e.target.value })} />
      </Field>
      <Field label="Never mention" htmlFor={id("a")} className="mt-4">
        <Textarea id={id("a")} rows={2} value={p.avoid} onChange={(e) => set({ avoid: e.target.value })} />
      </Field>
      <div className="mt-4">
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">Highlights customers can pick</div>
        <ul className="mb-3 flex flex-wrap gap-2">
          {p.highlights.map((h: DraftHighlight, i) => (
            <li key={i}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink py-1 pl-3 pr-1.5 text-[13px] text-white">
                {h.label}
                <button
                  type="button"
                  title="Click to change: positive, negative, either"
                  onClick={() => set({ highlights: p.highlights.map((x, j) => (j === i ? { ...x, polarity: x.polarity === "pos" ? "neg" : x.polarity === "neg" ? "both" : "pos" } : x)) })}
                  className="rounded bg-white/20 px-1.5 text-[11px] hover:bg-white/30"
                >
                  {h.polarity === "pos" ? "pos" : h.polarity === "neg" ? "neg" : "both"}
                </button>
                <button type="button" aria-label={`Remove ${h.label}`} onClick={() => set({ highlights: p.highlights.filter((_, j) => j !== i) })} className="grid size-5 place-items-center rounded-full hover:bg-white/20">
                  <X size={12} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="New highlight"
            className="max-w-[240px]"
            value={label}
            placeholder="e.g. Acceleration"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addH();
              }
            }}
          />
          <Segmented<Polarity>
            label="Polarity"
            value={pol}
            onChange={setPol}
            options={[{ value: "pos", label: "Positive" }, { value: "neg", label: "Negative" }, { value: "both", label: "Both" }]}
          />
          <Button variant="line" size="sm" onClick={addH}>Add</Button>
        </div>
      </div>
      {p.memories.length > 0 && (
        <div className="mt-4">
          <MemoryList title="Remembered about this product" items={p.memories} onChange={(memories) => set({ memories })} />
        </div>
      )}
    </section>
  );
}

function TestStep({ saved, onFinish }: { saved: { brandId: string; products: SavedProduct[]; warning?: string }; onFinish: () => void }) {
  const [pid, setPid] = useState(saved.products[0]?.id ?? "");
  const [rating, setRating] = useState(5);
  const [length, setLength] = useState<"short" | "detailed">("short");
  const [picked, setPicked] = useState<string[]>([]);
  const [variant, setVariant] = useState(0);
  const [text, setText] = useState("");
  const [model, setModel] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const prod = saved.products.find((p) => p.id === pid);
  const hs = (prod?.highlights ?? []).filter((h) => (rating <= 3 ? h.polarity !== "pos" : h.polarity !== "neg"));

  function generate(v: number) {
    setErr("");
    setMsg("");
    start(async () => {
      const r = await sampleAction({ brandId: saved.brandId, productId: pid, rating, highlightIds: picked, length, variant: v }).catch(() => null);
      if (!r || !r.ok) return setErr(r?.error || OFFLINE);
      setText(r.text);
      setModel(r.model);
      setVariant(v);
    });
  }
  function saveEx() {
    setErr("");
    start(async () => {
      const r = await saveExampleAction({ brandId: saved.brandId, productId: pid, rating, text }).catch(() => null);
      if (!r || !r.ok) return setErr(r?.error || OFFLINE);
      setMsg("Saved as an example. It will guide future drafts.");
    });
  }

  return (
    <div className="space-y-5">
      <Note icon={<Check size={16} aria-hidden />}>
        <b>{"Brand saved."}</b> You can change details from Brand, Products and Portals. {saved.warning}
      </Note>
      <div className="grid gap-4 min-[700px]:grid-cols-2">
        <Field label="Product" htmlFor="t-prod">
          <Select id="t-prod" value={pid} onChange={(e) => { setPid(e.target.value); setPicked([]); }}>
            {saved.products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-2" id="t-r">Rating</div>
          <div role="radiogroup" aria-labelledby="t-r" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => { setRating(n); setPicked([]); }}
                className="grid size-9 place-items-center rounded hover:bg-surface"
              >
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill={n <= rating ? "var(--color-ink)" : "none"} stroke="var(--color-ink)" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
      {hs.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Highlights">
          {hs.map((h) => (
            <Chip key={h.id} on={picked.includes(h.id)} onClick={() => setPicked((a) => (a.includes(h.id) ? a.filter((x) => x !== h.id) : [...a, h.id]))}>
              {h.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<"short" | "detailed"> label="Length" value={length} onChange={setLength} options={[{ value: "short", label: "Short" }, { value: "detailed", label: "Detailed" }]} />
        <Button onClick={() => generate(text ? variant + 1 : 0)} disabled={pending || !pid}>
          {pending ? "Writing…" : text ? "New sample" : "Generate sample"}
        </Button>
      </div>
      <div role="status" aria-live="polite">
        {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
        {msg && <p className="text-sm font-medium text-ok">{msg}</p>}
      </div>
      {text && (
        <div className="relative pb-3 pr-3">
          <div aria-hidden className="absolute inset-0 left-3 top-3 rounded border border-carbon bg-wash" />
          <div className="relative rounded border border-ink bg-white px-[18px] pb-3.5 pt-4">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-ink-3">
              <span>Sample · {rating} star{rating === 1 ? "" : "s"}</span>
              <Pill tone={model === "demo" ? "neutral" : "blue"}>{model === "demo" ? "Demo draft" : "AI"}</Pill>
            </div>
            <Textarea aria-label="Sample review" rows={5} className="border-0 px-0 text-[17px] shadow-none focus:shadow-none" value={text} onChange={(e) => { setText(e.target.value); setMsg(""); }} />
            <div className="mt-2 flex justify-end">
              <Button variant="line" size="sm" onClick={saveEx} disabled={pending}>Save as example</Button>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-rule pt-5">
        <Button onClick={onFinish}>Finish</Button>
      </div>
    </div>
  );
}
