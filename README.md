# Review Assist

Next.js 15 (App Router) on Cloudflare Workers via `@opennextjs/cloudflare`, D1 + Drizzle, R2 for logos, OpenRouter for drafts. See `docs/IMPLEMENTATION.md`.

## Setup
```bash
bun install
cp .dev.vars.example .dev.vars        # set ADMIN_PASSWORD and SESSION_SECRET
bun run db:migrate:local              # create tables in the local D1
bun run db:seed:local                 # demo data (Lopez Dental; product links demo241abc / demo242def / demo243ghi)
bun run dev                           # http://localhost:3000/admin  (customer page: /r/demo241abc)
```

AI providers (OpenRouter, Claude, ChatGPT) are connected by an admin in **Settings**; keys are tested, then stored AES-GCM encrypted in D1 (key derived from `AI_KEYS_SECRET`, else `SESSION_SECRET`). `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars also work. With none connected, drafts use the deterministic demo generator and page scans fall back to titles and headings.

## Scripts
`dev`, `build`, `typecheck`, `lint`, `db:generate` (after editing `src/db/schema.ts`), `db:migrate:local`, `db:seed:local`, `preview` (build + run in workerd), `deploy`.

## Deploy
1. D1 `review-assist` + R2 `review-assist-uploads` (ids already in `wrangler.jsonc` for the sometechwork account).
2. `bunx wrangler d1 migrations apply DB --remote`
3. `bunx wrangler secret put SESSION_SECRET` (optionally `AI_KEYS_SECRET` and provider keys). Password login is local-only.
4. `bun run deploy` → https://review-assist.sometechwork.workers.dev
5. Cloudflare Access protects `/admin*` (customer `/r/*` stays public). Set Worker secret `CF_ACCESS_AUD` to the Access app AUD tag after creating the app.
