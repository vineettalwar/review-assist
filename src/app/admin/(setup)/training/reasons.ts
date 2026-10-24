/** Quick reasons for disliking a draft, each saved as one style rule the model follows from then on. */
export const DISLIKE_REASONS = [
  { key: "salesy", label: "Too salesy", rule: "Keep it plain and personal. No sales or marketing tone." },
  { key: "long", label: "Too long", rule: "Use fewer words. Cut filler and repeated points." },
  { key: "generic", label: "Generic", rule: "Mention one concrete detail from the facts instead of general praise." },
  { key: "ai", label: "Sounds like AI", rule: "Avoid polished, AI-sounding phrasing. Write the way a busy person types a quick review." },
  { key: "invented", label: "Invented something", rule: "Never add details that are not in the facts or the customer's notes." },
  { key: "formal", label: "Too formal", rule: "Write casually, like telling a colleague how it went." },
] as const;

export type DislikeReason = (typeof DISLIKE_REASONS)[number]["key"];
