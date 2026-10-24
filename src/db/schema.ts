import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const brand = sqliteTable("brand", {
  id: text("id").primaryKey().default("default"),
  name: text("name").notNull().default(""),
  about: text("about").notNull().default(""),
  voice: text("voice", { enum: ["warm", "professional", "casual", "brief"] }).notNull().default("warm"),
  voiceNotes: text("voice_notes").notNull().default(""),
  wordsToAvoid: text("words_to_avoid").notNull().default(""),
  defaultLanguage: text("default_language").notNull().default("en"),
  logoKey: text("logo_key"),
  website: text("website").notNull().default(""),
  // Brand brain: who the customers are and brand-level facts every draft may use (one per line).
  audience: text("audience").notNull().default(""),
  facts: text("facts").notNull().default(""),
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default(""),
  knowledge: text("knowledge").notNull().default(""),
  avoid: text("avoid").notNull().default(""),
  url: text("url").notNull().default(""),
  // Product context, one item per line. Feeds the prompt and the angle picker that keeps drafts unique.
  audience: text("audience").notNull().default(""),
  experience: text("experience").notNull().default(""),
  praise: text("praise").notNull().default(""),
  concerns: text("concerns").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("products_brand").on(t.brandId)]);

export const highlights = sqliteTable("highlights", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  label: text("label").notNull(),
  polarity: text("polarity", { enum: ["pos", "neg", "both"] }).notNull().default("pos"),
  sort: integer("sort").notNull().default(0),
  labelJa: text("label_ja").notNull().default(""),
}, (t) => [index("highlights_product").on(t.productId)]);

export const examples = sqliteTable("examples", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  productId: text("product_id"),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  source: text("source", { enum: ["manual", "playground"] }).notNull().default("manual"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("examples_brand").on(t.brandId)]);

export const portals = sqliteTable("portals", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  type: text("type", { enum: ["google", "trustpilot", "amazon", "yelp", "facebook", "g2", "custom"] }).notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  allowsIncentives: integer("allows_incentives", { mode: "boolean" }).notNull().default(false),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("portals_brand").on(t.brandId)]);

export const productPortals = sqliteTable(
  "product_portals",
  {
    productId: text("product_id").notNull(),
    portalId: text("portal_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.portalId] })],
);

// One reward row per brand: reward.id === brand.id
export const reward = sqliteTable("reward", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  kind: text("kind", { enum: ["code", "link", "manual"] }).notNull().default("code"),
  value: text("value").notNull().default(""),
});

export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    token: text("token").notNull(),
    productId: text("product_id").notNull(),
    customerName: text("customer_name").notNull().default(""),
    language: text("language").notNull().default("en"),
    visitNotes: text("visit_notes").notNull().default(""),
    // "product" = the one permanent link for a product; every page load is a new visit with a fresh draft.
    kind: text("kind", { enum: ["customer", "product"] }).notNull().default("customer"),
    status: text("status", { enum: ["created", "opened", "copied", "claimed", "disabled"] }).notNull().default("created"),
    portalId: text("portal_id"),
    createdAt: integer("created_at").notNull(),
    openedAt: integer("opened_at"),
    copiedAt: integer("copied_at"),
  },
  (t) => [uniqueIndex("links_token_unique").on(t.token), index("links_product").on(t.productId), index("links_brand_recent").on(t.brandId, t.createdAt)],
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    linkId: text("link_id").notNull(),
    visitId: text("visit_id").notNull().default(""),
    productId: text("product_id").notNull().default(""),
    rating: integer("rating").notNull(),
    highlightKeys: text("highlight_keys").notNull().default("[]"),
    length: text("length", { enum: ["short", "detailed"] }).notNull(),
    variant: integer("variant").notNull().default(0),
    text: text("text").notNull(),
    model: text("model").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("drafts_visit_key").on(t.linkId, t.visitId, t.rating, t.highlightKeys, t.length, t.variant),
    index("drafts_product_recent").on(t.productId, t.createdAt),
  ],
);

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  linkId: text("link_id").notNull(),
  visitId: text("visit_id").notNull().default(""), // product links: one claim per visit
  portalId: text("portal_id").notNull(),
  email: text("email").notNull(),
  status: text("status", { enum: ["pending", "approved", "sent"] }).notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("claims_link").on(t.linkId), index("claims_visit").on(t.visitId)]);

// Brand / product memory. productId null = brand-level. Only status 'active' reaches the prompt.
export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  productId: text("product_id"),
  kind: text("kind", { enum: ["fact", "style", "avoid"] }).notNull(),
  text: text("text").notNull(),
  source: text("source", { enum: ["admin", "onboarding", "playground", "customer", "scan"] }).notNull().default("admin"),
  status: text("status", { enum: ["proposed", "active", "archived"] }).notNull().default("active"),
  evidence: text("evidence").notNull().default(""), // why it was proposed (e.g. the edit that taught it)
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("memories_brand_status").on(t.brandId, t.status)]);

// What the customer actually copied to a portal, kept to learn from customer edits. No name or email.
export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  linkId: text("link_id").notNull(),
  visitId: text("visit_id").notNull().default(""),
  productId: text("product_id").notNull(),
  portalId: text("portal_id").notNull(),
  rating: integer("rating").notNull(),
  draftText: text("draft_text").notNull().default(""),
  finalText: text("final_text").notNull(),
  edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  learnedAt: integer("learned_at"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("submissions_brand").on(t.brandId, t.edited), index("submissions_link_visit").on(t.linkId, t.visitId), index("submissions_product_recent").on(t.productId, t.createdAt)]);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  model: text("model").notNull().default("openai/gpt-4o-mini"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(400),
  systemPromptExtra: text("system_prompt_extra").notNull().default(""),
  // Review languages the brand offers, JSON array of codes ("en", "ja").
  languages: text("languages").notNull().default('["en"]'),
  // Single-brand focus: when set, the admin is locked to this brand and the switcher is hidden.
  focusBrandId: text("focus_brand_id").notNull().default(""),
  // Active AI provider. "" = first connected one (OpenRouter, then Claude, then ChatGPT).
  provider: text("provider").notNull().default(""),
});

/** One row per connected AI provider. The API key is AES-GCM encrypted; only its last 4 chars are kept in clear. */
export const aiProviders = sqliteTable("ai_providers", {
  id: text("id", { enum: ["openrouter", "anthropic", "openai"] }).primaryKey(),
  keyCipher: text("key_cipher").notNull(),
  keyHint: text("key_hint").notNull().default(""),
  model: text("model").notNull(),
  status: text("status", { enum: ["ok", "error", "untested"] }).notNull().default("untested"),
  lastError: text("last_error").notNull().default(""),
  testedAt: integer("tested_at"),
  updatedAt: integer("updated_at").notNull(),
});

/** One customer visit to a review link. Name and email are collected on the page and never sent to the AI. */
export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  linkId: text("link_id").notNull(),
  brandId: text("brand_id").notNull(),
  productId: text("product_id").notNull(),
  language: text("language").notNull().default("en"),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  /** When the customer ticked the follow-up opt-in (proof of consent); null means no contact beyond a reward. */
  contactOptInAt: integer("contact_opt_in_at"),
  rating: integer("rating").notNull().default(0),
  portalId: text("portal_id"),
  createdAt: integer("created_at").notNull(),
  copiedAt: integer("copied_at"),
}, (t) => [index("visits_brand_recent").on(t.brandId, t.createdAt), index("visits_link").on(t.linkId)]);

/** Writing the business likes (from anywhere). Drafts borrow its tone and structure, never its wording or facts. */
export const inspirations = sqliteTable("inspirations", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  productId: text("product_id"), // null = brand-wide
  text: text("text").notNull(),
  note: text("note").notNull().default(""), // what they like about it
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("inspirations_brand").on(t.brandId)]);

/** Fixed-window counters for rate limiting (login, draft generation, claims). */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at").notNull(),
});

export type Brand = typeof brand.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Highlight = typeof highlights.$inferSelect;
export type Example = typeof examples.$inferSelect;
export type Portal = typeof portals.$inferSelect;
export type Reward = typeof reward.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type AiProviderRow = typeof aiProviders.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type Inspiration = typeof inspirations.$inferSelect;
