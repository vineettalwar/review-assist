// The one place the app talks to an AI model. Callers get text or null (null = fall back to demo/basic).
import { eq } from "drizzle-orm";
import { aiProviders, aiUsage, getDb, settings, type AiProviderRow, type AiUsageRow } from "@/db";
import { getEnv, type AppEnv } from "@/lib/env";
import { decryptSecret, encryptSecret } from "./crypto";
import { PROVIDERS, PROVIDER_ORDER, callProvider, isProviderId, type CallResult, type ProviderId, type Usage } from "./providers";

export { PROVIDERS, PROVIDER_ORDER, isProviderId, cleanOutput, type ProviderId, type Usage } from "./providers";

const ENV_KEY: Record<ProviderId, keyof AppEnv> = {
  openrouter: "OPENROUTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export interface ProviderState {
  id: ProviderId;
  connected: boolean;
  source: "settings" | "env" | null; // settings wins over env when both exist
  keyHint: string;
  model: string;
  status: AiProviderRow["status"] | null;
  lastError: string;
  testedAt: number | null;
  unreadable: boolean; // a saved key that can no longer be decrypted
}

export interface AiStatus {
  active: ProviderState | null; // null = demo mode
  chosen: ProviderId | ""; // the admin's explicit choice, "" = automatic
  providers: ProviderState[];
}

async function load() {
  const db = await getDb();
  const [rows, [s], env] = await Promise.all([
    db.select().from(aiProviders),
    db.select().from(settings).where(eq(settings.id, "default")).limit(1),
    getEnv(),
  ]);
  return { rows, s, env };
}

async function readKey(env: AppEnv, row: AiProviderRow | undefined, id: ProviderId) {
  if (row?.keyCipher) {
    const key = await decryptSecret(env.AI_KEYS_SECRET, row.keyCipher);
    if (key) return { key, source: "settings" as const };
  }
  const fromEnv = env[ENV_KEY[id]];
  return fromEnv ? { key: fromEnv, source: "env" as const } : null;
}

/** Everything the Settings page needs. Never includes a key. */
export async function getAiStatus(): Promise<AiStatus> {
  const { rows, s, env } = await load();
  const providers: ProviderState[] = [];
  for (const id of PROVIDER_ORDER) {
    const row = rows.find((r) => r.id === id);
    const k = await readKey(env, row, id);
    const envModel = id === "openrouter" && s?.model ? s.model : PROVIDERS[id].defaultModel;
    providers.push({
      id,
      connected: !!k,
      source: k?.source ?? null,
      keyHint: k?.source === "settings" ? (row?.keyHint ?? "") : k ? k.key.slice(-4) : "",
      model: row?.model || envModel,
      status: k?.source === "settings" ? (row?.status ?? null) : null,
      lastError: k?.source === "settings" ? (row?.lastError ?? "") : "",
      testedAt: row?.testedAt ?? null,
      unreadable: !!row?.keyCipher && k?.source !== "settings",
    });
  }
  const chosen = isProviderId(s?.provider) ? s.provider : "";
  const active = providers.find((p) => p.id === chosen && p.connected) ?? providers.find((p) => p.connected) ?? null;
  return { active, chosen, providers };
}

async function resolve(): Promise<{ id: ProviderId; key: string; model: string; env: AppEnv; fromSettings: boolean } | null> {
  const { rows, s, env } = await load();
  const chosen = isProviderId(s?.provider) ? s.provider : null;
  const order = chosen ? [chosen, ...PROVIDER_ORDER.filter((p) => p !== chosen)] : PROVIDER_ORDER;
  for (const id of order) {
    const row = rows.find((r) => r.id === id);
    const k = await readKey(env, row, id);
    if (!k) continue;
    const model = row?.model || (id === "openrouter" && s?.model ? s.model : PROVIDERS[id].defaultModel);
    return { id, key: k.key, model, env, fromSettings: k.source === "settings" };
  }
  return null;
}

async function recordResult(id: ProviderId, r: CallResult, prev?: Pick<AiProviderRow, "status" | "lastError">) {
  const status = r.ok ? "ok" : "error";
  const lastError = r.ok ? "" : r.error;
  if (prev && prev.status === status && prev.lastError === lastError) return;
  const db = await getDb();
  await db.update(aiProviders).set({ status, lastError, testedAt: Date.now() }).where(eq(aiProviders.id, id));
}

/** What a call was for; recorded with its usage. */
export interface UsageMeta {
  source: AiUsageRow["source"];
  brandId?: string | null;
}

/** One usage row per call. Never throws: tracking must not break a customer's draft. */
async function recordUsage(meta: UsageMeta | undefined, provider: ProviderId, model: string, r: CallResult, ms: number) {
  if (!meta) return;
  try {
    const u = r.ok ? r.usage : undefined;
    const db = await getDb();
    await db.insert(aiUsage).values({
      id: crypto.randomUUID(),
      brandId: meta.brandId ?? null,
      source: meta.source,
      provider,
      model: model.slice(0, 120),
      inputTokens: u?.input ?? 0,
      outputTokens: u?.output ?? 0,
      costUsd: u?.costUsd ?? null,
      costSource: u?.costSource ?? null,
      ms,
      ok: r.ok,
      createdAt: Date.now(),
    });
  } catch {}
}

/**
 * Run a prompt on the active provider. Returns null when nothing is connected or the call fails,
 * so every caller keeps its non-AI fallback.
 */
export async function complete(
  prompt: { system: string; user: string },
  cfg: { temperature: number; maxTokens: number; timeoutMs?: number },
  meta?: UsageMeta,
): Promise<{ text: string; provider: ProviderId; model: string } | null> {
  const ai = await resolve();
  if (!ai) return null;
  const t0 = Date.now();
  const r = await callProvider(ai.id, ai.key, prompt, { ...cfg, model: ai.model, appUrl: ai.env.APP_URL });
  await recordUsage(meta, ai.id, ai.model, r, Date.now() - t0);
  if (ai.fromSettings) {
    const db = await getDb();
    const [row] = await db.select({ status: aiProviders.status, lastError: aiProviders.lastError }).from(aiProviders).where(eq(aiProviders.id, ai.id));
    await recordResult(ai.id, r, row).catch(() => {});
  }
  return r.ok ? { text: r.text, provider: ai.id, model: ai.model } : null;
}

export type CompleteWithResult =
  | { ok: true; text: string; usage: Usage | null; ms: number; provider: ProviderId; model: string; raw: unknown }
  | { ok: false; error: string; ms: number; provider: ProviderId; model: string; raw: unknown };

/**
 * Run a prompt on a specific provider and model (the Training page compares two side by side).
 * Unlike complete(), failures come back as errors instead of null, and usage is reported.
 */
export async function completeWith(
  target: { provider: ProviderId; model: string },
  prompt: { system: string; user: string },
  cfg: { temperature: number; maxTokens: number; timeoutMs?: number },
  meta?: UsageMeta,
): Promise<CompleteWithResult> {
  const { provider, model } = target;
  const { rows, env } = await load();
  const k = await readKey(env, rows.find((r) => r.id === provider), provider);
  if (!k) return { ok: false, error: `No ${PROVIDERS[provider].label} key is connected.`, ms: 0, provider, model, raw: null };
  const t0 = Date.now();
  const r = await callProvider(provider, k.key, prompt, { ...cfg, model, appUrl: env.APP_URL });
  const ms = Date.now() - t0;
  await recordUsage(meta, provider, model, r, ms);
  return r.ok
    ? { ok: true, text: r.text, usage: r.usage ?? null, ms, provider, model, raw: r.raw ?? null }
    : { ok: false, error: r.error, ms, provider, model, raw: r.raw ?? null };
}

export interface OpenRouterBalance {
  connected: boolean;
  /** USD. Each is null when OpenRouter didn't return it. */
  keyLimit: number | null;
  keyRemaining: number | null;
  keyUsage: number | null;
  accountCredits: number | null;
  accountUsage: number | null;
  error: string;
}

/** Credits for the connected OpenRouter key and account. Server-only; the key never leaves this module. */
export async function openRouterBalance(): Promise<OpenRouterBalance> {
  const empty = { keyLimit: null, keyRemaining: null, keyUsage: null, accountCredits: null, accountUsage: null };
  const { rows, env } = await load();
  const k = await readKey(env, rows.find((r) => r.id === "openrouter"), "openrouter");
  if (!k) return { connected: false, ...empty, error: "" };
  const get = async (path: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(`https://openrouter.ai/api/v1/${path}`, { headers: { Authorization: `Bearer ${k.key}` }, signal: ctrl.signal });
      const json = (await res.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
      return res.ok ? (json?.data ?? null) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const [key, credits] = await Promise.all([get("key"), get("credits")]);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    connected: true,
    keyLimit: num(key?.limit),
    keyRemaining: num(key?.limit_remaining),
    keyUsage: num(key?.usage),
    accountCredits: num(credits?.total_credits),
    accountUsage: num(credits?.total_usage),
    error: !key && !credits ? "OpenRouter didn't return balance details for this key." : "",
  };
}

/** A tiny real request, used before saving a key and by the Test button. */
export async function testProvider(id: ProviderId, key: string, model: string): Promise<CallResult> {
  const env = await getEnv();
  return callProvider(
    id,
    key,
    { system: "You are a connection check.", user: "Reply with the single word OK." },
    { model, temperature: 0, maxTokens: 16, timeoutMs: 20_000, appUrl: env.APP_URL },
  );
}

/** Test, then store (encrypted). Nothing is saved when the test fails. */
export async function connectProvider(id: ProviderId, key: string, model: string): Promise<CallResult> {
  const r = await testProvider(id, key, model);
  if (!r.ok) return r;
  const env = await getEnv();
  const db = await getDb();
  const values = {
    keyCipher: await encryptSecret(env.AI_KEYS_SECRET, key),
    keyHint: key.slice(-4),
    model,
    status: "ok" as const,
    lastError: "",
    testedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.insert(aiProviders).values({ id, ...values }).onConflictDoUpdate({ target: aiProviders.id, set: values });
  return r;
}

/** Re-test whatever key is in use for this provider (saved or env). */
export async function retestProvider(id: ProviderId, model?: string): Promise<CallResult> {
  const { rows, s, env } = await load();
  const row = rows.find((r) => r.id === id);
  const k = await readKey(env, row, id);
  if (!k) return { ok: false, error: "No key saved for this provider." };
  const m = model || row?.model || (id === "openrouter" && s?.model ? s.model : PROVIDERS[id].defaultModel);
  const r = await testProvider(id, k.key, m);
  if (row && k.source === "settings") await recordResult(id, r);
  return r;
}

/** Change the model. Tested first; for env keys a key-less row just holds the model. */
export async function setProviderModel(id: ProviderId, model: string): Promise<CallResult> {
  const r = await retestProvider(id, model);
  if (!r.ok) return r;
  const db = await getDb();
  const now = Date.now();
  await db
    .insert(aiProviders)
    .values({ id, keyCipher: "", keyHint: "", model, status: "ok", testedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: aiProviders.id, set: { model, status: "ok", lastError: "", testedAt: now, updatedAt: now } });
  return r;
}

/** Forget the saved key. An env key for the same provider (if any) takes over again. */
export async function disconnectProvider(id: ProviderId): Promise<void> {
  const db = await getDb();
  await db.delete(aiProviders).where(eq(aiProviders.id, id));
}

export async function setActiveProvider(id: ProviderId | ""): Promise<void> {
  const db = await getDb();
  const [s] = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
  if (s) await db.update(settings).set({ provider: id }).where(eq(settings.id, "default"));
  else await db.insert(settings).values({ id: "default", provider: id });
}

/** One choice in a model dropdown. Prices are USD per million tokens when the provider publishes them. */
export interface ModelOption {
  id: string;
  name: string;
  group: string;
  inPerM: number | null;
  outPerM: number | null;
}

export type ModelCatalog = Record<ProviderId, ModelOption[]>;

const CATALOG_TTL = 60 * 60 * 1000;
let catalogCache: { at: number; data: ModelCatalog } | null = null;

// Chat models only: OpenAI's list also holds embeddings, audio, image and moderation models.
const OPENAI_CHAT = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_SKIP = /(audio|realtime|tts|transcribe|embedding|image|search|moderation|instruct|codex)/;

const suggested = (id: ProviderId): ModelOption[] =>
  PROVIDERS[id].models.map((m) => ({ id: m, name: m, group: "Suggested", inPerM: null, outPerM: null }));

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCatalog(id: ProviderId, key: string | null): Promise<ModelOption[]> {
  const perM = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 1000) / 1000 : null;
  };
  if (id === "openrouter") {
    // The model list is public, so it loads even before a key is connected.
    type Row = { id: string; name?: string; pricing?: { prompt?: string; completion?: string }; architecture?: { output_modalities?: string[] } };
    const j = (await getJson("https://openrouter.ai/api/v1/models")) as { data?: Row[] } | null;
    return (j?.data ?? [])
      .filter((m) => typeof m.id === "string" && (m.architecture?.output_modalities ?? ["text"]).includes("text"))
      .map((m) => ({
        id: m.id,
        name: (m.name ?? m.id).replace(/^[^:]+:\s*/, ""),
        group: (m.id.split("/")[0] ?? "other").replace(/^~/, ""),
        inPerM: perM(m.pricing?.prompt),
        outPerM: perM(m.pricing?.completion),
      }));
  }
  if (!key) return [];
  if (id === "anthropic") {
    const j = (await getJson("https://api.anthropic.com/v1/models?limit=1000", { "x-api-key": key, "anthropic-version": "2023-06-01" })) as
      | { data?: { id: string; display_name?: string }[] }
      | null;
    return (j?.data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.id, group: "Claude", inPerM: null, outPerM: null }));
  }
  const j = (await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` })) as { data?: { id: string }[] } | null;
  return (j?.data ?? [])
    .filter((m) => OPENAI_CHAT.test(m.id) && !OPENAI_SKIP.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, name: m.id, group: "OpenAI", inPerM: null, outPerM: null }));
}

/**
 * Every model each provider offers, for the model dropdowns. The suggested models come first so the usual
 * choices stay one click away; if a provider can't be reached its list falls back to the suggestions. Keys never leave the server.
 */
export async function listModels(): Promise<ModelCatalog> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.data;
  const { rows, env } = await load();
  const entries = await Promise.all(
    PROVIDER_ORDER.map(async (id) => {
      const k = await readKey(env, rows.find((r) => r.id === id), id).catch(() => null);
      const all = await fetchCatalog(id, k?.key ?? null).catch(() => []);
      const byId = new Map(all.map((m) => [m.id, m]));
      const top = suggested(id).map((s) => ({ ...(byId.get(s.id) ?? s), group: "Suggested" }));
      const rest = all.filter((m) => !PROVIDERS[id].models.includes(m.id)).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
      return [id, [...top, ...rest]] as const;
    }),
  );
  const data = Object.fromEntries(entries) as ModelCatalog;
  // Only cache a complete answer, so a provider that was briefly down is retried on the next page load.
  if (entries.every(([id, list]) => list.length > PROVIDERS[id].models.length || id !== "openrouter")) catalogCache = { at: Date.now(), data };
  return data;
}
