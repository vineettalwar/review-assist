import type { PromptInput } from "./types";

const TONES: Record<string, string> = {
  warm: "warm and friendly",
  professional: "professional and polished",
  casual: "casual and relaxed",
  brief: "brief and to the point",
};

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Best-effort PII scrub: the customer's name never reaches the model. */
export function scrubNotes(notes: string, customerName?: string) {
  const name = (customerName ?? "").trim();
  if (!name) return notes.trim();
  return notes.replace(new RegExp(`\\b${esc(name)}\\b`, "gi"), "the customer").trim();
}

function ratingRule(r: number) {
  if (r === 0) return "No star rating has been chosen yet, so keep it friendly and lightly positive, without gushing. Do not raise problems unless the customer picked one.";
  if (r === 5) return "The rating is 5 out of 5: a clearly positive review.";
  if (r === 4) return "The rating is 4 out of 5: positive, with room for a small reservation if one is provided.";
  if (r === 3) return "The rating is 3 out of 5: a mixed review, with both good and not-so-good points.";
  if (r === 2) return "The rating is 2 out of 5: a plainly negative review. Do not sugarcoat it.";
  return "The rating is 1 out of 5: a clearly negative review. Do not sugarcoat it.";
}

export function buildPrompt(i: PromptInput): { system: string; user: string } {
  const { brand, link, rating, length } = i;
  const r = rating;
  const lang = link.language || brand?.defaultLanguage || "en";
  const ja = lang === "ja";
  const sys: string[] = [
    `You write a first-draft customer review for ${brand?.name || "a business"}. The customer will read it, edit it and post it themselves, so it must sound like a real person.`,
    "",
    "Rules:",
    "- Write in the first person, as the customer.",
    ja
      ? "- Write in natural Japanese, the way a Japanese customer writes a Google or shop review: polite but not stiff (です/ます), Japanese punctuation (、。), no translated-from-English phrasing, no romaji. Keep the product name as written."
      : `- Write in this language: ${lang}.`,
    "- Only use the facts provided below. Never invent prices, staff names, dates, or medical or health claims.",
    `- ${ratingRule(rating)} Match this rating honestly.`,
    "- Weave the chosen highlights in naturally. Highlights that describe problems must be stated as problems, never spun as positives.",
    "- No hashtags, no emojis, no superlative spam, no marketing language.",
    "",
    "Sound like a real, friendly person:",
    ja
      ? "- Friendly and natural, like telling a friend how it went. Plain everyday words, short sentences, a little personality. Not a press release."
      : "- Friendly and natural, like telling a friend how it went. Plain everyday words, contractions (I'm, it's, didn't), a mix of short and longer sentences, a little personality. An exclamation mark is fine for a happy review, at most one.",
    r < 3 && r > 0 ? "- Even when unhappy, stay friendly and fair: say what went wrong calmly, no anger or sarcasm." : "- Be specific about one or two real details instead of praising everything.",
    ja
      ? "- Never use dashes of any kind (—, –, ―). Use 、 or 。 instead. No bullet points or lists."
      : "- Never use em dashes or en dashes (— or –), and no hyphens as dashes. Use a comma or a new sentence instead. No semicolons, no bullet points, no lists of three adjectives.",
    ja
      ? "- Avoid stiff, translated or advertising phrases (「〜と言っても過言ではありません」「まさに」「最高峰」)."
      : "- Avoid words that sound written by AI or marketing: seamless, elevate, delve, game-changer, top-notch, exceptional, testament, journey, hassle-free, \"I can't recommend enough\", \"Overall,\", \"In conclusion\". Don't open with \"I recently\".",
    length === "short"
      ? ja ? "- Length: 1 to 3 sentences, about 40 to 100 Japanese characters." : "- Length: 1 to 3 sentences."
      : ja ? "- Length: 4 to 6 sentences, about 150 to 300 Japanese characters." : "- Length: 4 to 6 sentences.",
    "- Every customer gets a different draft. Never reuse the openings listed below, and do not follow a fixed template.",
    "- Do not invent personal circumstances (family, job, trips, dates) that are not in the notes.",
    "- Do not turn specs into personal feats or long-term use (no \"I hit 250 mph\", no \"I've driven it for months\"). Mention specs as things you noticed or liked.",
    "- Do not invent complaints. Only mention a problem if the customer picked one or the rating is 3 or lower.",
    "- Return only the review text, as plain text, with no quotes, title or commentary.",
    "",
    "Brand voice:",
    `- Tone: ${TONES[brand?.voice ?? "warm"] ?? "warm and friendly"}.`,
  ];
  if (brand?.about) sys.push(`- About the business: ${brand.about}`);
  if (brand?.audience) sys.push(`- Typical customers: ${brand.audience}`);
  if (brand?.voiceNotes) sys.push(`- Voice notes: ${brand.voiceNotes}`);
  if (brand?.wordsToAvoid) sys.push(`- Never use these words or phrases: ${brand.wordsToAvoid}`);
  return { system: sys.join("\n"), user: buildUser(i) };
}

function buildUser(i: PromptInput) {
  const { product, link, rating, highlights, length, examples, variant } = i;
  const u: string[] = [];
  u.push(`Product or service: ${product.name}${product.category ? ` (${product.category})` : ""}`);
  if (product.audience) u.push(`Who it is for:\n${product.audience}`);
  if (product.knowledge) u.push(`Facts you may use:\n${product.knowledge}`);
  if (product.experience) u.push(`What customers typically go through (use only what fits):\n${product.experience}`);
  if (product.praise) u.push(`What customers often appreciate (use only if it matches the rating and highlights):\n${product.praise}`);
  if (product.concerns) u.push(`What customers sometimes raise (only for lower ratings or matching highlights):\n${product.concerns}`);
  if (i.brand?.facts) u.push(`Brand facts you may use:\n${i.brand.facts}`);
  if (product.avoid) u.push(`Never mention:\n${product.avoid}`);
  const mem = i.memory ?? [];
  const facts = mem.filter((m) => m.kind === "fact");
  const style = mem.filter((m) => m.kind === "style");
  const avoid = mem.filter((m) => m.kind === "avoid");
  if (facts.length) u.push(`More facts you may use (remembered):\n${facts.map((m) => `- ${m.text}`).join("\n")}`);
  if (style.length) u.push(`Style to follow (remembered):\n${style.map((m) => `- ${m.text}`).join("\n")}`);
  if (avoid.length) u.push(`Never mention (remembered):\n${avoid.map((m) => `- ${m.text}`).join("\n")}`);
  const notes = scrubNotes(link.visitNotes, link.customerName);
  if (notes) u.push(`Notes about this customer's experience:\n${notes}`);
  u.push(`Star rating: ${rating === 0 ? "not chosen yet" : `${rating} out of 5`}`);
  u.push(
    highlights.length
      ? `Highlights the customer picked:\n${highlights.map((h) => `- ${h.label}${h.polarity === "neg" ? " (a problem)" : ""}`).join("\n")}`
      : "Highlights the customer picked: none",
  );
  if (examples.length) {
    u.push(
      "Examples of the style wanted (do not copy them):\n" +
        examples.map((e) => `[${e.rating} stars] ${e.text}`).join("\n"),
    );
  }
  const insp = i.inspirations ?? [];
  if (insp.length) {
    u.push(
      "Writing the business likes (take tone, rhythm and structure only. Never copy its wording, and never use facts, names or numbers from it):\n" +
        insp.map((x) => `${x.note ? `- What they like about it: ${x.note}\n` : "- "}  """${x.text}"""`).join("\n"),
    );
  }
  if (i.plan) u.push(i.plan);
  const used = (i.usedOpenings ?? []).filter(Boolean).slice(0, 12);
  if (used.length) u.push(`Openings other customers already used (do not start like these, do not reuse their wording):\n${used.map((o) => `- ${o}…`).join("\n")}`);
  if (variant > 0) u.push(`This is alternative number ${variant + 1}: use different wording and structure from earlier drafts.`);
  if (i.retryNote) u.push(i.retryNote);
  u.push(`Write the ${length} review now.`);
  return u.join("\n\n");
}
