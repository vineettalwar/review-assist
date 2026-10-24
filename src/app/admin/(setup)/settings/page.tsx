import { eq } from "drizzle-orm";
import { PageHeader, Section, Field, Input, Textarea, Note, Pill, SubmitButton } from "@/components/ui";
import { getDb, settings } from "@/db";
import { PROVIDERS, getAiStatus, listModels, type ModelOption, type ProviderId } from "@/lib/ai";
import { ModelSelect } from "../../ModelSelect";
import type { ProviderState } from "@/lib/ai";
import { Flash } from "../flash";
import { activateAi, connectAi, disconnectAi, saveAiModel, saveFocus, saveLanguages, saveSettings, testAi } from "./actions";
import { REVIEW_LANGUAGES, parseLanguages } from "@/lib/i18n/languages";
import { listBrands } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const db = await getDb();
  const [[s], ai, brands] = await Promise.all([db.select().from(settings).where(eq(settings.id, "default")), getAiStatus(), listBrands()]);
  const catalog = await listModels();
  const active = ai.active;
  const langs = parseLanguages(s?.languages);

  return (
    <>
      <PageHeader title="Settings" description="Languages, focus and AI provider." />
      <Flash saved={sp.saved} error={sp.error} />
      <Note>
        {active ? (
          <><b>Connected</b> · {PROVIDERS[active.id].label} · <span className="font-mono text-[13px]">{active.model}</span>.</>
        ) : (
          <><b>Demo mode.</b> No AI provider is connected. Drafts come from a built-in template writer and page scans only copy the description and a few factual lines. Connect one below.</>
        )}
      </Note>

      <div className="max-w-[760px]">
        <Section title="AI providers" description="Keys are stored encrypted and never shown again.">
          <div className="grid gap-3">
            {ai.providers.map((p) => (
              <ProviderRow key={p.id} p={p} isActive={active?.id === p.id} options={catalog[p.id]} />
            ))}
          </div>
        </Section>

        <form action={saveLanguages}>
          <Section title="Review languages" description="Links follow the customer's browser language. Add ?lang=ja to force one.">
            <fieldset className="grid gap-2">
              <legend className="sr-only">Review languages</legend>
              {REVIEW_LANGUAGES.map((l) => (
                <label key={l.code} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" name="lang" value={l.code} defaultChecked={langs.includes(l.code)} className="size-4 accent-[var(--color-carbon)]" />
                  {l.label} <span className="text-ink-3">{l.native !== l.label ? l.native : ""}</span>
                </label>
              ))}
            </fieldset>
            
            <div className="mt-4"><SubmitButton variant="line" pending="Saving…">Save languages</SubmitButton></div>
          </Section>
        </form>

        <form action={saveFocus}>
          <Section title="Brand focus" description="Hides the brand switcher.">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <label htmlFor="focusBrandId" className="mb-1.5 block text-[13px] font-medium">Brand in focus</label>
                <select id="focusBrandId" name="focusBrandId" defaultValue={s?.focusBrandId ?? ""} className="h-[42px] w-full rounded border border-rule bg-white px-3 text-sm">
                  <option value="">None, allow switching</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name || "Untitled brand"}</option>)}
                </select>
              </div>
              <SubmitButton variant="line" pending="Saving…">Save focus</SubmitButton>
            </div>
          </Section>
        </form>

        <form action={saveSettings}>
          <Section title="Writing">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Temperature" htmlFor="temperature" hint="0 is steady, 1.5 is adventurous.">
                  <Input id="temperature" name="temperature" type="number" step="0.1" min={0} max={1.5} defaultValue={s?.temperature ?? 0.7} required />
                </Field>
                <Field label="Max tokens" htmlFor="maxTokens" hint="Upper bound on draft length, 100 to 1000.">
                  <Input id="maxTokens" name="maxTokens" type="number" step="10" min={100} max={1000} defaultValue={s?.maxTokens ?? 400} required />
                </Field>
              </div>
              <Field label="Extra system prompt" htmlFor="systemPromptExtra">
                <Textarea id="systemPromptExtra" name="systemPromptExtra" rows={4} defaultValue={s?.systemPromptExtra ?? ""} />
              </Field>
            </div>
          </Section>
          <SubmitButton pending="Saving…">Save settings</SubmitButton>
        </form>
      </div>
    </>
  );
}

function StatusPill({ p, isActive }: { p: ProviderState; isActive: boolean }) {
  if (!p.connected) return <Pill>{p.unreadable ? "Key unreadable" : "Not connected"}</Pill>;
  if (p.status === "error") return <Pill tone="amber" dot>Last call failed</Pill>;
  if (isActive) return <Pill tone="blue" dot>In use</Pill>;
  return <Pill tone="green" dot>Connected</Pill>;
}

function Hidden({ id }: { id: ProviderId }) {
  return <input type="hidden" name="provider" value={id} />;
}

function ModelInput({ p, id, options }: { p: ProviderState; id: string; options: ModelOption[] }) {
  return <ModelSelect id={id} name="model" options={options} defaultValue={p.model} />;
}

function ProviderRow({ p, isActive, options }: { p: ProviderState; isActive: boolean; options: ModelOption[] }) {
  const meta = PROVIDERS[p.id];
  const fid = `ai-${p.id}`;
  return (
    <div className={`rounded border p-4 ${isActive ? "border-carbon" : "border-rule"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base">{meta.label}</h3>
          <p className="text-[13px] text-ink-3">{meta.vendor}</p>
        </div>
        <StatusPill p={p} isActive={isActive} />
      </div>

      {p.connected ? (
        <div className="mt-3 grid gap-3">
          <p className="text-[13px] text-ink-2">
            Key ending <span className="font-mono">…{p.keyHint}</span> · {p.source === "env" ? "from environment" : "saved"}
          </p>
          {p.lastError && <p className="text-[13px] text-warn">{p.lastError}</p>}
          <form action={saveAiModel} className="flex flex-wrap items-end gap-2">
            <Hidden id={p.id} />
            <div className="min-w-[220px] flex-1">
              <label htmlFor={`${fid}-model`} className="mb-1.5 block text-[13px] font-medium">Model</label>
              <ModelInput p={p} id={`${fid}-model`} options={options} />
            </div>
            <SubmitButton variant="line" pending="Testing…">Save model</SubmitButton>
          </form>
          <div className="flex flex-wrap gap-2">
            {!isActive && (
              <form action={activateAi}><Hidden id={p.id} /><SubmitButton size="sm">Use {meta.label}</SubmitButton></form>
            )}
            <form action={testAi}><Hidden id={p.id} /><SubmitButton size="sm" variant="line" pending="Testing…">Test connection</SubmitButton></form>
            {p.source === "settings" && (
              <form action={disconnectAi}><Hidden id={p.id} /><SubmitButton size="sm" variant="ghost" pending="Removing…">Disconnect</SubmitButton></form>
            )}
          </div>
        </div>
      ) : (
        <form action={connectAi} className="mt-3 grid gap-3">
          <Hidden id={p.id} />
          {p.unreadable && <p className="text-[13px] text-warn">The saved key can no longer be read (the server secret changed). Paste it again.</p>}
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <Field label="API key" htmlFor={`${fid}-key`} hint={<>{meta.keyHelp}. <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Get a key</a></>}>
              <Input id={`${fid}-key`} name="apiKey" type="password" autoComplete="off" spellCheck={false} required placeholder="Paste key" />
            </Field>
            <Field label="Model" htmlFor={`${fid}-model`} hint="Every model this provider offers. Pick Other to type any id.">
              <ModelInput p={p} id={`${fid}-model`} options={options} />
            </Field>
          </div>
          <div><SubmitButton pending="Testing the key…">Connect {meta.label}</SubmitButton></div>
        </form>
      )}
    </div>
  );
}
