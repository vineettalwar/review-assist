/** A client's rule set. Draft rules reach every prompt for that client; team rules are a checklist for the agency only. */
export interface ClientRules {
  draft: string[];
  team: string[];
}

export const RULE_MAX = 300;
export const RULES_MAX = 40;

const clean = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, RULE_MAX))
    .filter(Boolean)
    .slice(0, RULES_MAX);

/** Parses brand.rules; bad or missing JSON gives empty lists. */
export function parseRules(raw: string | null | undefined): ClientRules {
  try {
    const j = JSON.parse(raw || "{}") as Partial<ClientRules>;
    return { draft: clean(j.draft), team: clean(j.team) };
  } catch {
    return { draft: [], team: [] };
  }
}

/** One rule per line from a textarea, with list bullets stripped. */
export function rulesFromText(text: string): string[] {
  return clean(text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "")));
}
