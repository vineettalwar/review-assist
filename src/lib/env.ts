import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AppEnv = {
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  /** Encrypts provider keys saved from Settings. Falls back to SESSION_SECRET. */
  AI_KEYS_SECRET: string;
  APP_URL: string;
  /** e.g. https://aged-sun-abae.cloudflareaccess.com — set in wrangler vars. */
  CF_ACCESS_TEAM_DOMAIN: string;
  /** Access application AUD tag — set as a Worker secret after creating the Access app. */
  CF_ACCESS_AUD: string;
};

/** Secrets and vars from the Cloudflare context (.dev.vars locally). Falls back to process.env. */
export async function getEnv(): Promise<AppEnv> {
  const { env } = await getCloudflareContext({ async: true });
  const e = env as unknown as Record<string, string | undefined>;
  const pick = (k: string) => e[k] ?? process.env[k] ?? "";
  return {
    ADMIN_PASSWORD: pick("ADMIN_PASSWORD"),
    SESSION_SECRET: pick("SESSION_SECRET"),
    OPENROUTER_API_KEY: pick("OPENROUTER_API_KEY").trim(),
    ANTHROPIC_API_KEY: pick("ANTHROPIC_API_KEY").trim(),
    OPENAI_API_KEY: pick("OPENAI_API_KEY").trim(),
    AI_KEYS_SECRET: pick("AI_KEYS_SECRET") || pick("SESSION_SECRET"),
    APP_URL: (pick("APP_URL") || "http://localhost:3000").replace(/\/$/, ""),
    CF_ACCESS_TEAM_DOMAIN: pick("CF_ACCESS_TEAM_DOMAIN").replace(/\/$/, ""),
    CF_ACCESS_AUD: pick("CF_ACCESS_AUD").trim(),
  };
}

export async function getR2() {
  const { env } = await getCloudflareContext({ async: true });
  return env.UPLOADS;
}
