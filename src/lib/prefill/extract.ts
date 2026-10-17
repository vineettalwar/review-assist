// Pure HTML -> text extraction (no DOM available on the edge). Regex based and defensive.

export interface PageInfo {
  url: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  siteName: string;
  headings: string[];
  body: string; // visible paragraph/list text
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", deg: "°", times: "×",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
      } catch {
        return m;
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function metaContent(html: string, attr: "name" | "property", value: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const a = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']${value}["']`, "i"));
    if (!a) continue;
    const c = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (c) return decodeEntities((c[1] ?? c[2] ?? "").replace(/\s+/g, " ").trim());
  }
  return "";
}

export function extractPage(url: string, html: string, maxChars = 12_000): PageInfo {
  const title = clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, "name", "description");
  const ogTitle = metaContent(html, "property", "og:title");
  const ogDescription = metaContent(html, "property", "og:description");
  const siteName = metaContent(html, "property", "og:site_name");

  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|nav|footer|svg|template|iframe|form|header)\b[\s\S]*?<\/\1\s*>/gi, " ");

  const headings: string[] = [];
  for (const m of stripped.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    const t = clean(m[2]);
    if (t && t.length <= 200 && !headings.includes(t)) headings.push(t);
  }

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const m of stripped.matchAll(/<(p|li|dd|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const t = clean(m[2]);
    if (t.length < 20 || seen.has(t)) continue;
    seen.add(t);
    parts.push(t);
  }

  // Budget: headings first, then body, capped at maxChars overall.
  let budget = maxChars - (title.length + description.length + ogDescription.length + 100);
  const hs: string[] = [];
  for (const h of headings) {
    if (budget - h.length < maxChars / 2) break;
    hs.push(h);
    budget -= h.length + 1;
  }
  let body = "";
  for (const p of parts) {
    if (body.length + p.length + 1 > budget) break;
    body += (body ? "\n" : "") + p;
  }
  return { url, title, description, ogTitle, ogDescription, siteName, headings: hs, body };
}

export function pageToText(p: PageInfo): string {
  return [
    `URL: ${p.url}`,
    p.title && `Title: ${p.title}`,
    p.siteName && `Site name: ${p.siteName}`,
    p.ogTitle && `OG title: ${p.ogTitle}`,
    p.description && `Meta description: ${p.description}`,
    p.ogDescription && p.ogDescription !== p.description && `OG description: ${p.ogDescription}`,
    p.headings.length && `Headings:\n${p.headings.map((h) => `- ${h}`).join("\n")}`,
    p.body && `Text:\n${p.body}`,
  ]
    .filter(Boolean)
    .join("\n");
}
