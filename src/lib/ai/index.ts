// The one place the app talks to an AI model. Callers get text or null (null = fall back to demo/basic).
import { eq } from "drizzle-orm";
import { aiProviders, getDb, settings, type AiProviderRow } from "@/db";
import { getEnv, type AppEnv } from "@/lib/env";
import { decryptSecret, encryptSecret } from "./crypto";
import { PROVIDERS, PROVIDER_ORDER, callProvider, isProviderId, type CallResult, type ProviderId } from "./providers";

export { PROVIDERS, PROVIDER_ORDER, isProviderId, cleanOutput, type ProviderId } from "./providers";

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

/**
 * Run a prompt on the active provider. Returns null when nothing is connected or the call fails,
 * so every caller keeps its non-AI fallback.
 */
export async function complete(
  prompt: { system: string; user: string },
  cfg: { temperature: number; maxTokens: number; timeoutMs?: number },
): Promise<{ text: string; provider: ProviderId; model: string } | null> {
  const ai = await resolve();
  if (!ai) return null;
  const r = await callProvider(ai.id, ai.key, prompt, { ...cfg, model: ai.model, appUrl: ai.env.APP_URL });
  if (ai.fromSettings) {
    const db = await getDb();
    const [row] = await db.select({ status: aiProviders.status, lastError: aiProviders.lastError }).from(aiProviders).where(eq(aiProviders.id, ai.id));
    await recordResult(ai.id, r, row).catch(() => {});
  }
  return r.ok ? { text: r.text, provider: ai.id, model: ai.model } : null;
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
