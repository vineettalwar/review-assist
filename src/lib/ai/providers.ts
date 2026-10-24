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
    models: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-haiku-4.5", "meta-llama/llama-3.3-70b-instruct"],
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

export interface Usage {
  input: number;
  output: number;
  /** USD. "provider" = billed amount reported by the provider, "estimate" = from PRICES, null = unknown model. */
  costUsd: number | null;
  costSource: "provider" | "estimate" | null;
}

/** `raw` is the provider's parsed JSON response, kept for the Training page's response view. */
export type CallResult = { ok: true; text: string; usage?: Usage; raw?: unknown } | { ok: false; error: string; raw?: unknown };

/** USD per million tokens [input, output] for direct keys; OpenRouter reports its own billed cost. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-haiku-4-5": [1, 5],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-5-mini": [0.25, 2],
  "gpt-5": [1.25, 10],
};

function usageFrom(id: ProviderId, model: string, json: unknown): Usage | undefined {
  const u = (json as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u) return undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const input = num(id === "anthropic" ? u.input_tokens : u.prompt_tokens);
  const output = num(id === "anthropic" ? u.output_tokens : u.completion_tokens);
  if (id === "openrouter" && typeof u.cost === "number") return { input, output, costUsd: u.cost, costSource: "provider" };
  const price = PRICES[model];
  if (!price) return { input, output, costUsd: null, costSource: null };
  return { input, output, costUsd: (input * price[0] + output * price[1]) / 1_000_000, costSource: "estimate" };
}

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

function finish(r: Awaited<ReturnType<typeof post>>, pick: (json: unknown) => string, id: ProviderId, model: string): CallResult {
  if ("error" in r) return { ok: false, error: r.error };
  if (r.status < 200 || r.status >= 300) return { ok: false, error: describe(r.status, errMessage(r.json)), raw: r.json };
  const text = cleanOutput(pick(r.json));
  return text
    ? { ok: true, text, usage: usageFrom(id, model, r.json), raw: r.json }
    : { ok: false, error: "The model returned an empty reply.", raw: r.json };
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
    return finish(
      r,
      (j) => ((j as { content?: { type: string; text?: string }[] }).content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
      id,
      cfg.model,
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
    return finish(r, pickChat, id, cfg.model);
  }

  const r = await postWithRetry(
    "https://openrouter.ai/api/v1/chat/completions",
    { Authorization: `Bearer ${key}`, ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}), "X-Title": "Review Assist" },
    // usage.include makes OpenRouter report the billed cost alongside the token counts.
    { model: cfg.model, temperature: cfg.temperature, max_tokens: cfg.maxTokens, messages, usage: { include: true } },
    ["temperature"],
    timeout,
  );
  return finish(r, pickChat, id, cfg.model);
}
