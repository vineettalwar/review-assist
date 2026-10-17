# Review Assist — Build Plan (v1)

Single business. Admin sets up brand, products, and portals, then generates a unique link per customer.
The customer opens the link, finds a review draft already written for them, picks their own rating, edits if they like, and copies it to the portal.

## Stack
- **Next.js (App Router)** on **Cloudflare Workers** via `@opennextjs/cloudflare`
- **D1** (SQLite) + **Drizzle ORM** for all data
- **R2** for the brand logo upload
- **OpenRouter** for generation (model, temperature, and key set in admin Settings; key stored as a Worker secret)
- **Tailwind** for styling; bun for local dev (`wrangler dev` for D1 locally)
- Admin auth: single admin password (Worker secret) → signed httpOnly cookie

## Design direction (after hyperfolio.framer.website)
- White canvas, near-black text, one blue accent, very light blue tint for a few surfaces
- Large, tight, bold display headings; calm body text; lots of whitespace
- Pill buttons: filled blue for primary, outlined for secondary
- Rounded cards with a hairline border and no heavy shadows; no stat-card dashboards
- Customer page: single centered column, mobile-first

## Data model (D1)
| Table | Key fields |
|---|---|
| `brand` (1 row) | name, logo_url, about, voice/tone, words_to_avoid, default_language |
| `products` | id, name, category, knowledge (free text: highlights, what to avoid), highlight_chips (json), active |
| `portals` | id, type (google/trustpilot/amazon/yelp/facebook/g2/custom), label, url, allows_incentives, is_default |
| `product_portals` | product_id, portal_id (overrides brand default portals) |
| `reward` (1 row) | enabled, title, description, terms, kind (code/link/manual), value |
| `links` | token (unique, unguessable), product_id, customer_first_name, language, visit_notes, tone, status, created/opened/copied timestamps |
| `drafts` | link_id, variant (short/detailed), text, model, created_at (cached generation) |
| `claims` | link_id, name, email, portal_id, status (pending/approved/sent), created_at |
| `settings` | model_id, temperature, max_tokens |

## Admin app (`/admin`)
1. **Brand**: name, logo, about, voice, words to avoid, default language
2. **Products**: list plus a simple form: name, category, knowledge notes, quick-highlight chips. CSV import comes later.
3. **Portals**: add from presets (Google, Trustpilot, Amazon, Yelp, Facebook, G2) or a custom URL; mark defaults; per-product override
4. **Links**: "New link" form (product, customer first name, language, optional visit notes, tone) → unique URL with copy button; list shows status (created → opened → copied → claimed)
5. **Rewards**: one generic reward config plus a claims table (approve / mark sent)
6. **Settings**: OpenRouter model ID, temperature, max tokens, and a "test generation" button

## Customer page (`/r/[token]`)
**Standalone page.** It has no navigation, no header menu, no links to the admin area or anywhere else; the only outbound links are the portal buttons. Each link is unique to one customer: an unguessable token (~10 chars, random, not derived from the name) mapped to one product and visit. An unknown or disabled token shows a plain "This link isn't active" page. The page is `noindex` and is not listed in a sitemap.

1. Greeting with brand logo: "Hi Emily, thanks for visiting {brand}"
2. **Star rating: customer picks it. Never pre-filled.**
3. **Draft already written** (customers are lazy): generated from brand voice, product knowledge, and visit notes, in the customer's language. It comes in two variants (Short / Detailed), and the customer can tap between them.
4. Quick highlight chips ("Friendly staff", "On time", ...). Tapping chips or changing the rating regenerates the draft so it matches. A low rating gives an honest, constructive draft, not a glowing one.
5. Editable textarea
6. Portal buttons: **"Copy & open Google"** etc. copies the text to the clipboard and opens the portal in a new tab, followed by a "Pasted it? Done" confirmation
7. **Reward block appears only after the copy/submit step**, and only if (a) a reward is enabled **and** (b) the chosen portal has `allows_incentives = true`. It is never tied to rating or wording.

### Generation
- Generated once per link, on first open, and cached in `drafts`; regeneration happens on chip or rating change
- Only brand/product context, visit notes, rating, chips, and language are sent to the LLM. **The customer's name/email are never sent.**
- The system prompt enforces first person, no invented facts beyond the provided context, no superlative spam, and output that matches the selected rating

## Compliance rules (hard-coded, not configurable)
- **Incentive lock:** Google, Amazon, Trustpilot, Yelp, and Facebook presets ship with `allows_incentives = false` and the toggle is **disabled** for them. Only custom portals (e.g. your own site) can enable rewards. The reward UI never renders next to a locked portal.
- **No review gating:** low ratings see the same public portals as high ratings (gating is banned by Google and the FTC).
- **No pre-filled stars**, and drafts follow the customer's rating.
- Footer note: "Edit freely — only post what reflects your real experience."

## Build order
1. Scaffold Next.js + OpenNext Cloudflare + D1/Drizzle + Tailwind, design tokens, admin auth
2. Brand, Products, Portals CRUD
3. Link creation + token + links list
4. OpenRouter wrapper + prompt + draft cache + Settings
5. Customer page (rating, chips, variants, copy & open, status tracking)
6. Rewards config + claim form + claims table, with the incentive lock enforced server-side
7. Polish: mobile, empty states, i18n fallback to English, seed data (a demo dental clinic)

## Later (not in v1)
CSV product import · sending links by email/SMS · multi-business · analytics · pre-generation batch mode
