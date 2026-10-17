// Raw HTTP clients for the three supported providers. No DB access here.

export type ProviderId = "openrouter" | "anthropic" | "openai";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  vendor: string;
  keyHelp: string;
  keyUrl: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    vendor: "Many models through one key",
    keyHelp: "Starts with sk-or-",
    keyUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"],
  },
  anthropic: {
    id: "anthropic",
    label: "Claude",
    vendor: "Anthropic",
    keyHelp: "Starts with sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-haiku-5-5",
    models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"],
  },
  openai: {
    id: "openai",
    label: "ChatGPT",
    vendor: "OpenAI",
    keyHelp: "Starts with sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4.1-mini", "gpt-4o-mini", "gpt-5-mini", "gpt-5"],
  },
};

/** Order used when no provider is explicitly chosen. */
export const PROVIDER_ORDER: ProviderId[] = ["openrouter", "anthropic", "openai"];

export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && v in PROVIDERS;

export interface CallConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  appUrl?: string;
}

export type CallResult = { ok: true; text: string } | { ok: false; error: string };

type Body = Record<string, unknown>;

function describe(status: number, message: string): string {
  const m = message.replace(/\s+/g, " ").trim().slice(0, 180);
  const head =
    status === 401 || status === 403 ? "Key rejected"
    : status === 402 ? "Out of credit"
    : status === 404 ? "Model not found"
    : status === 429 ? "Rate limited or out of credit"
    : status >= 500 ? "Provider is having trouble"
    : `Request failed (${status})`;
  return m ? `${head}: ${m}` : head;
}

async function post(url: string, headers: Record<string, string>, body: Body, timeoutMs: number): Promise<{ status: number; json: unknown } | { error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (e) {
    return { error: e instanceof Error && e.name === "AbortError" ? `Timed out after ${Math.round(timeoutMs / 1000)}s` : "Network error" };
  } finally {
    clearTimeout(timer);
  }
}

const errMessage = (json: unknown): string => {
  const e = (json as { error?: { message?: string } | string } | null)?.error;
  return typeof e === "string" ? e : (e?.message ?? "");
};

/**
 * POST, and if the provider rejects one of `optional` params (some models refuse temperature, for example),
 * retry once without it.
 */
async function postWithRetry(url: string, headers: Record<string, string>, body: Body, optional: string[], timeoutMs: number) {
  let r = await post(url, headers, body, timeoutMs);
  if ("status" in r && r.status === 400) {
    const msg = errMessage(r.json).toLowerCase();
    const drop = optional.filter((p) => p in body && msg.includes(p));
    if (drop.length) {
      const next = { ...body };
      for (const p of drop) delete next[p];
      r = await post(url, headers, next, timeoutMs);
    }
  }
  return r;
}

/** Strips wrapping quotes the models sometimes add. */
export function cleanOutput(s: string) {
  let t = s.trim();
  for (;;) {
    const n = t.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
    if (n === t) break;
    t = n;
  }
  return t;
}

function finish(r: Awaited<ReturnType<typeof post>>, pick: (json: unknown) => string): CallResult {
  if ("error" in r) return { ok: false, error: r.error };
  if (r.status < 200 || r.status >= 300) return { ok: false, error: describe(r.status, errMessage(r.json)) };
  const text = cleanOutput(pick(r.json));
  return text ? { ok: true, text } : { ok: false, error: "The model returned an empty reply." };
}

export async function callProvider(id: ProviderId, key: string, prompt: { system: string; user: string }, cfg: CallConfig): Promise<CallResult> {
  const timeout = cfg.timeoutMs ?? 20_000;
  const messages = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];

  if (id === "anthropic") {
    const r = await postWithRetry(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model: cfg.model, max_tokens: cfg.maxTokens, temperature: cfg.temperature, system: prompt.system, messages: [{ role: "user", content: prompt.user }] },
      ["temperature"],
      timeout,
    );
    return finish(r, (j) =>
      ((j as { content?: { type: string; text?: string }[] }).content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
    );
  }

  const pickChat = (j: unknown) => (j as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";

  if (id === "openai") {
    // Reasoning models spend tokens thinking before they answer and reject a custom temperature.
    const reasoning = /^(gpt-5|o\d)/.test(cfg.model);
    const body: Body = reasoning
      ? { model: cfg.model, messages, max_completion_tokens: cfg.maxTokens + 2000, reasoning_effort: cfg.model.startsWith("gpt-5") ? "minimal" : "low" }
      : { model: cfg.model, messages, max_completion_tokens: cfg.maxTokens, temperature: cfg.temperature };
    const r = await postWithRetry("https://api.openai.com/v1/chat/completions", { Authorization: `Bearer ${key}` }, body, ["temperature", "reasoning_effort"], timeout);
    return finish(r, pickChat);
  }

  const r = await postWithRetry(
    "https://openrouter.ai/api/v1/chat/completions",
    { Authorization: `Bearer ${key}`, ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}), "X-Title": "Review Assist" },
    { model: cfg.model, temperature: cfg.temperature, max_tokens: cfg.maxTokens, messages },
    ["temperature"],
    timeout,
  );
  return finish(r, pickChat);
}
