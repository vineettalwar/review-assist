// Types for Cloudflare bindings and secrets. Regenerate bindings with `bun run cf-typegen`.
interface CloudflareEnv {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  OPENROUTER_API_KEY?: string;
  APP_URL?: string;
}
