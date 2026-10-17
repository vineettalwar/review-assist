# Review Assist: Implementation Spec (v1)

The source of truth for every build agent. Product context lives in `PRODUCT.md` and `PLAN.md`. The visual system lives in `DESIGN.md` (Carbon Copy), with working references in `design/review-link.html` and `design/admin.html`. Match those drafts and do not invent a new look.

## Stack
- Next.js 15 (App Router, TypeScript, `src/`), Tailwind CSS v4, bun
- Cloudflare Workers via `@opennextjs/cloudflare`, with `wrangler.jsonc` at the repo root
- D1 (binding `DB`) with Drizzle ORM (`drizzle-orm/d1`) and drizzle-kit migrations in `drizzle/`
- R2 (binding `UPLOADS`) for logos. In dev, a local miniflare bucket is fine.
- OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) through plain `fetch`, with no SDK
- GSAP 3.12 and Lenis 1.1, used only on the customer page
- Font: Schibsted Grotesk via `next/font/google`

## Env / secrets (`.dev.vars` locally, `wrangler secret` in prod)
- `ADMIN_PASSWORD`: the single admin password
- `SESSION_SECRET`: HMAC key for the admin cookie
- `OPENROUTER_API_KEY`: when empty, generation falls back to the deterministic **demo generator** so the app works without a key
- `APP_URL`: used to build links, e.g. `http://localhost:3000`

## Folder ownership (parallel agents: only touch your own area)
| Area | Paths | Owner |
|---|---|---|
| Foundation | `package.json`, configs, `wrangler.jsonc`, `src/db/**`, `drizzle/**`, `src/lib/auth.ts`, `src/lib/env.ts`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/admin/layout.tsx`, `src/components/ui/**`, `src/app/admin/login/**` | Scaffold agent |
| Generation | `src/lib/generation/**`, `src/app/api/drafts/**` | Agent G |
| Customer page | `src/app/r/**`, `src/components/review/**`, `src/app/api/r/**` | Agent C |
| Admin: Brand, Products, Training, Settings | `src/app/admin/(setup)/**` | Agent A |
| Admin: Links, Portals, Rewards | `src/app/admin/(ops)/**` | Agent B |

Shared UI primitives live in `src/components/ui/` and are created by the scaffold. Other agents may **add** new files there but never change existing ones. Server actions sit next to their pages in `actions.ts`.

## Data model (`src/db/schema.ts`, Drizzle sqlite-core)
All ids are text (`crypto.randomUUID()`). Timestamps are integers holding unix ms.

```
brand           id='default' (single row) | name | about | voice ('warm'|'professional'|'casual'|'brief') | voiceNotes | wordsToAvoid | defaultLanguage ('en') | logoKey (R2 key, nullable) | updatedAt
products        id | name | category | knowledge (text: facts the AI may use) | avoid (text: what never to mention) | active (bool) | createdAt | updatedAt
highlights      id | productId | label | polarity ('pos'|'neg'|'both') | sort        -- the customer chips
examples        id | productId (nullable = brand-wide) | rating (1-5) | text | source ('manual'|'playground') | createdAt   -- few-shot "training" reviews
portals         id | type ('google'|'trustpilot'|'amazon'|'yelp'|'facebook'|'g2'|'custom') | label | url | allowsIncentives (bool) | isDefault (bool) | sort
product_portals productId | portalId                                    -- overrides; empty = use portals where isDefault
reward          id='default' | enabled | title | description | kind ('code'|'link'|'manual') | value
links           id | token (unique, 10 chars, [a-z0-9], crypto random) | productId | customerName | language | visitNotes | status ('created'|'opened'|'copied'|'claimed'|'disabled') | portalId (last used, nullable) | createdAt | openedAt | copiedAt
drafts          id | linkId | rating (0-5) | highlightKeys (json text) | length ('short'|'detailed') | variant (int) | text | model | createdAt
                -- unique index (linkId, rating, highlightKeys, length, variant) = cache key
claims          id | linkId | portalId | email | status ('pending'|'approved'|'sent') | createdAt
settings        id='default' | model ('openai/gpt-4o-mini') | temperature (0.7) | maxTokens (400) | systemPromptExtra (text)
```

**Hard rule (enforced server-side, not only in the UI):** `allowsIncentives` is forced to `false` for the types google, trustpilot, amazon, yelp and facebook, on insert and update. A claim is rejected unless its portal allows incentives and the link status is `copied` or later. The helper for this is `src/lib/compliance.ts`, which the scaffold writes:
`LOCKED_TYPES`, `canIncentivize(portal)`, and `assertClaimAllowed(link, portal)`.

Seed data (`drizzle/seed.sql`, labelled demo): the brand **Lopez Dental**; the products Teeth cleaning, Whitening and Check-up, each with knowledge and highlights (pos: Friendly staff, Clear explanations, Short wait, Gentle cleaning; both: Clean office; neg: Long wait, Felt rushed, Unclear costs); the portals Google (default), Trustpilot (default) and Our website (custom, incentives on, default); a reward of 15% off with code THANKS15; settings defaults; and one link for Emily (token `demo241abc`).

## Generation (`src/lib/generation/`), owned by Agent G
- `buildPrompt({brand, product, examples, link, rating, highlights, length, variant})` returns `{system, user}` and includes:
  - the brand voice, voiceNotes, wordsToAvoid, product knowledge and avoid list, and up to 4 examples (preferring the same product and a rating within ±1)
  - the rules: first person; write in `link.language`; only use the facts provided; never invent prices, names or medical claims; match the given rating honestly (2 stars means a plainly negative review, 3 stars a mixed one, 0 means no rating yet so stay neutral); weave the chosen highlights in naturally, stating negatives as negatives; no hashtags, emojis or superlative spam; short is 1–3 sentences and detailed is 4–6; return plain text only
  - **PII:** the customer's name and email are never sent, though visitNotes are. Strip any name the admin typed into the notes, as a best effort, by replacing `link.customerName` with "the customer".
- `generateDraft(input)` reads cache, then calls OpenRouter (or `demoGenerate` when there's no key), then writes cache. It returns `{text, model, cached}`.
- `demoGenerate` is deterministic and template-based. Port the `compose()` logic from `design/review-link.html`, generalised to highlights.
- `POST /api/drafts` takes `{token, rating, highlightKeys, length, variant}` and returns `{text}`. It validates the token and that the link is not disabled. Rate limit: max 30 generations per link (count drafts rows) before serving only cached results.
- The playground action `previewDraft(productId, rating, highlightKeys, length, notes)` is exported for Agent A and doesn't touch the cache.

## Customer page `/r/[token]`, owned by Agent C
- Server component: load the link, brand, product, highlights and resolved portals; set `opened`/`openedAt` the first time it's opened; handle an unknown or disabled link with the "This link isn't active." view; set `noindex` metadata; no nav, no admin links.
- The client component is a faithful port of `design/review-link.html`, including every behaviour: ink stars, chips filtered by polarity (≤3 stars swaps to neg/both), Short/Detailed, New draft (variant+1), word-diff typing animation, the edited-text guard with "Rewrite for N stars" and Undo, the carbon handover on copy, the clipboard fallback, the after-copy block, and a reward block **only** when `canIncentivize(portal)` and the reward is enabled. Lenis smooth scroll and GSAP, with reduced-motion respected.
- The initial draft is generated on the server for (rating 0, highlights pre-selected from visit notes by matching label words, short, variant 0), so the page loads with the text already present.
- `POST /api/r/[token]/copied` takes `{portalId}`, sets status `copied`, and records copiedAt and portalId.
- `POST /api/r/[token]/claim` takes `{email}` and goes through `assertClaimAllowed`, then inserts a claim and sets status `claimed`.

## Admin `(setup)`, owned by Agent A
- `/admin/brand`: name, logo upload (to R2 via a server action), about, voice chips, voice notes, words to avoid, default language.
- `/admin/products`: a list, with create and edit on `/admin/products/[id]` covering name, category, **knowledge**, **avoid**, highlight chips (add, remove, set polarity), portal overrides, and active. Plus CSV import (`name,category,knowledge`).
- `/admin/training`: the "train" area.
  1. **Playground:** pick a product, rating, highlights, length and optional sample notes, click Generate to get a draft via `previewDraft`, then edit it and "Save as example".
  2. **Examples:** a list of saved example reviews, with filters by product and rating, and manual add, edit and delete. These feed the few-shot prompt.
  3. A **knowledge checklist** per product that flags thin knowledge (under 80 chars, or no highlights).
- `/admin/settings`: model id (text plus suggestions: openai/gpt-4o-mini, anthropic/claude-haiku-4.5, meta-llama/llama-3.1-8b-instruct), temperature, max tokens, extra system prompt, plus an API-key status (configured or demo mode; the key itself is never shown).

## Admin `(ops)`, owned by Agent B
- `/admin` redirects to `/admin/links`.
- `/admin/links`: the new-link form (customer first name, product, language, visit notes) creates a token and shows the URL `${APP_URL}/r/${token}` with Copy. Below it is a table with customer, product, created, a status pill, and per-row Copy link, Open and Disable.
- `/admin/portals`: a list with add, edit and delete from presets plus custom, a default toggle, and order. The incentive toggle is disabled with a lock icon for locked types, with the note callout from the draft.
- `/admin/rewards`: the reward config (enable, title, description, kind, value) and the claims table (approve, mark sent). It notes which portals the reward shows on.

## Definition of done (each agent)
`bun run typecheck` and `bun run lint` pass with zero errors in your paths; pages render under `bun run dev` with the seeded DB; there are no edits outside your paths; and you report the files you created.

## Scaffold facts (added after foundation landed)
- Seed lives at `drizzle/seed/seed.sql`, outside the migrations dir. `bun run db:migrate:local && bun run db:seed:local`.
- Import the UI from `@/components/ui` (`Button`/`buttonClass`, `Input`, `Textarea`, `Select`, `Field`, `Pill`, `Toggle`, `Chip`, `Segmented`, `PageHeader`, `Card`/`Section`, `Note`, `Table`/`Th`/`Td`/`Tr`, `icons`, `cn`).
- DB: `const db = await getDb()` from `@/db`, which re-exports the schema tables and types.
- Every mutating server action calls `await requireAdmin()` from `@/lib/auth` first.
- Compliance: `@/lib/compliance` provides `normalizePortal`, `canIncentivize` and `assertClaimAllowed`.
- `/admin` → `/admin/links` is handled by `src/app/admin/page.tsx`. Do NOT add `(ops)/page.tsx`.
- Generation contract: `src/lib/generation/index.ts` (fixed exports: `generateDraft`, `previewDraft`, `preselectHighlights`, `LinkInactiveError`, types). Highlight keys are highlight **ids**, sorted.
- Dev servers: each agent uses its own port (`bun run dev -- -p <port>`) and stops it when done. Never `pkill` broadly; kill only the PID you started.

---

# Phase 2: multiple brands, onboarding and memory

## Data (already migrated: `drizzle/0001_multi_brand_memory.sql`)
- `brand` now has many rows (`id`, `website`, `createdAt` added). The existing Lopez Dental row keeps id `default`.
- `brandId` (NOT NULL) is on **products, portals, examples and links**. Highlights and product_portals follow their product. Claims and drafts follow their link.
- `reward` holds one row per brand, with **reward.id === brand.id**. Create it lazily (enabled=false) when it's missing.
- `settings` stays global: model, temperature and key status.
- New tables:
  - `memories` (brandId, productId|null, kind fact|style|avoid, text, source, status proposed|active|archived, evidence)
  - `submissions` (what the customer copied: draftText, finalText, edited, rating, portalId; no name or email)

## Active brand
- `src/lib/brand.ts` provides `getActiveBrand()`, `requireActiveBrand()`, `listBrands()` and `setActiveBrandCookie(id)`. The cookie is `ra_brand` (path `/admin`), validated on every read, with a fallback to the first brand.
- **Every admin query and insert is scoped to the active brand.**
  - Reads filter by `brandId`.
  - Inserts set `brandId: active.id`.
  - Updates and deletes include `brandId` in their WHERE clause, so a crafted id from another brand can't touch rows outside the active brand.
- Customer-facing code never uses the cookie; it resolves the brand from `link.brandId`.
- If no brand exists, admin pages redirect to `/admin/onboarding`.

## Generation (done)
`loadContext` loads the product's own brand and that brand's examples, plus up to 24 active memories (product-level first). The prompt adds the sections "More facts you may use (remembered)", "Style to follow (remembered)" and "Never mention (remembered)".

## Contracts (fixed exports, stubs in place)
- `src/lib/memory/index.ts`: `addMemories`, `listMemories`, `setMemoryStatus`, `updateMemoryText`, `proposeFromEdit`, `learnFromSubmissions`
- `src/lib/prefill/index.ts`: `prefillFromUrls`
- OpenRouter helper: `callOpenRouter` in `src/lib/generation/openrouter.ts`. Read it before reusing it.

## Ownership for this phase
| Agent | Paths |
|---|---|
| L (libs) | `src/lib/memory/**`, `src/lib/prefill/**` |
| S (setup) | `src/app/admin/(setup)/**` (incl. new `(setup)/memory/`) |
| B (ops) | `src/app/admin/(ops)/**` |
| C (customer) | `src/app/r/**`, `src/components/review/**`, `src/app/api/r/**`, `src/app/api/drafts/**` |
| O (onboarding + shell) | `src/app/admin/onboarding/**`, `src/app/admin/AdminShell.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/brand-actions.ts` |

Do not edit `src/db/**`, `src/lib/brand.ts`, `src/lib/generation/**`, `drizzle/**` or another agent's paths. If you need a change there, say so in your report.

## Memory rules
- Admin-created memory is `active`. Memory from onboarding, the playground and customers is `proposed` until the admin approves it.
- A memory is one short sentence. Facts must come from the business's own material and are never invented.
- The brand-level vs product-level scope is visible everywhere a memory is shown.
