// Loads a client from a data folder into D1: brand, rules, portals, products, highlights, inspirations and product links.
// Real client data stays out of git (clients/ is ignored); this script is the only way it reaches a database.
//
//   bun scripts/load-client.ts clients/<name>           # local database (run inside the app container)
//   bun scripts/load-client.ts clients/<name> --remote  # the live Cloudflare database
//
// Ids in the data file are stable, so re-running updates the client in place. Product links keep their visit history.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

type Highlight = { id: string; label: string; labelDe?: string; labelJa?: string; polarity?: "pos" | "neg" | "both"; kind?: "point" | "situation" };
type ClientFile = {
  brand: {
    id: string; name: string; website?: string; about?: string; audience?: string; facts?: string[]; voice?: string;
    voiceNotes?: string; wordsToAvoid?: string[]; defaultLanguage?: string; strict?: boolean;
    rules?: { draft?: string[]; team?: string[] }; createdAt?: number;
  };
  languages?: string[];
  portals: { id: string; type: string; label: string; url: string; minChars?: number; isDefault?: boolean }[];
  highlightSets?: Record<string, Highlight[]>;
  products: {
    id: string; name: string; category?: string; url?: string; market?: string; priority?: number; knowledge?: string[];
    avoid?: string[]; audience?: string; portals?: string[]; highlights?: (Highlight | string)[]; linkToken?: string;
  }[];
  inspirations?: { id: string; text: string; note?: string; productId?: string | null; active?: boolean }[];
  /** Remembered notes that reach every prompt (style, avoid, fact); loaded as active. */
  memories?: { id: string; kind: "fact" | "style" | "avoid"; text: string; productId?: string | null; evidence?: string }[];
};

const dir = process.argv[2];
const remote = process.argv.includes("--remote");
if (!dir) {
  console.error("Usage: bun scripts/load-client.ts <client folder> [--remote]");
  process.exit(1);
}
const data = JSON.parse(readFileSync(join(dir, "client.json"), "utf8")) as ClientFile;

const q = (v: unknown) => (v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${String(v).replace(/'/g, "''")}'`);
const lines = (a?: string[]) => (a ?? []).join("\n");
const now = Date.now();
const b = data.brand;
const sql: string[] = [];

sql.push(
  `INSERT INTO brand (id,name,about,voice,voice_notes,words_to_avoid,default_language,website,audience,facts,rules,strict,created_at,updated_at) VALUES (` +
    [b.id, b.name, b.about ?? "", b.voice ?? "warm", b.voiceNotes ?? "", (b.wordsToAvoid ?? []).join(", "), b.defaultLanguage ?? "en", b.website ?? "",
      b.audience ?? "", lines(b.facts), JSON.stringify({ draft: b.rules?.draft ?? [], team: b.rules?.team ?? [] }), !!b.strict, b.createdAt ?? now, now].map(q).join(",") +
    `) ON CONFLICT(id) DO UPDATE SET name=excluded.name,about=excluded.about,voice=excluded.voice,voice_notes=excluded.voice_notes,` +
    `words_to_avoid=excluded.words_to_avoid,default_language=excluded.default_language,website=excluded.website,audience=excluded.audience,` +
    `facts=excluded.facts,rules=excluded.rules,strict=excluded.strict,updated_at=excluded.updated_at;`,
);
// Reward stays off: the review sites in play forbid it or require disclosure the page doesn't do.
sql.push(`INSERT OR IGNORE INTO reward (id,enabled,title,description,kind,value) VALUES (${q(b.id)},0,'','','code','');`);

data.portals.forEach((p, i) => {
  sql.push(
    `INSERT OR REPLACE INTO portals (id,brand_id,type,label,url,allows_incentives,is_default,min_chars,sort) VALUES (` +
      [p.id, b.id, p.type, p.label, p.url, false, !!p.isDefault, p.minChars ?? 0, i].map(q).join(",") + `);`,
  );
});

const ids = data.products.map((p) => q(p.id)).join(",");
const keepHl: string[] = [];
data.products.forEach((p) => {
  sql.push(
    `INSERT INTO products (id,brand_id,name,category,knowledge,avoid,url,audience,market,priority,active,created_at,updated_at) VALUES (` +
      [p.id, b.id, p.name, p.category ?? "", lines(p.knowledge), lines(p.avoid), p.url ?? "", p.audience ?? "", p.market ?? "", p.priority ?? 0, true, now, now].map(q).join(",") +
      `) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,knowledge=excluded.knowledge,avoid=excluded.avoid,url=excluded.url,` +
      `audience=excluded.audience,market=excluded.market,priority=excluded.priority,updated_at=excluded.updated_at;`,
  );
  sql.push(`DELETE FROM product_portals WHERE product_id=${q(p.id)};`);
  for (const portalId of p.portals ?? []) sql.push(`INSERT INTO product_portals (product_id,portal_id) VALUES (${q(p.id)},${q(portalId)});`);

  // A string names a shared set; highlight ids get the product id as prefix so each product has its own rows.
  const hs = (p.highlights ?? []).flatMap((h) => (typeof h === "string" ? (data.highlightSets?.[h] ?? []) : [h]));
  hs.forEach((h, i) => {
    const id = `${p.id}:${h.id}`;
    keepHl.push(q(id));
    const kind = h.kind ?? "point";
    sql.push(
      `INSERT OR REPLACE INTO highlights (id,product_id,label,polarity,sort,label_ja,label_de,kind) VALUES (` +
        [id, p.id, h.label, kind === "situation" ? "both" : (h.polarity ?? "pos"), i, h.labelJa ?? "", h.labelDe ?? "", kind].map(q).join(",") + `);`,
    );
  });
  if (p.linkToken) {
    sql.push(
      `INSERT OR IGNORE INTO links (id,brand_id,token,product_id,customer_name,language,visit_notes,kind,status,created_at) VALUES (` +
        [`link-${p.id}`, b.id, p.linkToken, p.id, "", "", "", "product", "created", now].map(q).join(",") + `);`,
    );
  }
});
if (ids) sql.push(`DELETE FROM highlights WHERE product_id IN (${ids})${keepHl.length ? ` AND id NOT IN (${keepHl.join(",")})` : ""};`);

for (const x of data.inspirations ?? []) {
  sql.push(
    `INSERT OR REPLACE INTO inspirations (id,brand_id,product_id,text,note,active,created_at) VALUES (` +
      [x.id, b.id, x.productId ?? null, x.text, x.note ?? "", x.active ?? true, now].map(q).join(",") + `);`,
  );
}

for (const m of data.memories ?? []) {
  sql.push(
    `INSERT OR REPLACE INTO memories (id,brand_id,product_id,kind,text,source,status,evidence,created_at,updated_at) VALUES (` +
      [m.id, b.id, m.productId ?? null, m.kind, m.text, "admin", "active", m.evidence ?? "", now, now].map(q).join(",") + `);`,
  );
}

// Review languages are a global setting: add the client's, never remove others.
for (const lang of data.languages ?? []) {
  sql.push(
    `UPDATE settings SET languages=(SELECT json_group_array(v) FROM (SELECT value AS v FROM json_each(settings.languages) UNION SELECT ${q(lang)})) ` +
      `WHERE id='default' AND NOT EXISTS (SELECT 1 FROM json_each(settings.languages) WHERE value=${q(lang)});`,
  );
}

const file = join(dir, ".load.sql");
writeFileSync(file, sql.join("\n") + "\n");
console.log(`Wrote ${sql.length} statements to ${file}`);
execFileSync("bunx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", `--file=${file}`, "--yes"], { stdio: "inherit" });
