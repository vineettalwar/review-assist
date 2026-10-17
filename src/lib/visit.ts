// Signed visit ids. A product link is reusable, so each page load gets its own visit; drafts are cached per visit.
import { getEnv } from "@/lib/env";
import { isLang, type Lang } from "@/lib/i18n/languages";

const enc = new TextEncoder();
const VISIT_TTL_MS = 12 * 60 * 60 * 1000;

async function sign(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode("visit:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let s = "";
  for (const b of sig.subarray(0, 16)) s += b.toString(16).padStart(2, "0");
  return s;
}

/** Token "<visitId>.<lang>.<expires>.<sig>", signed together with the link id so it can't be replayed on another link. */
export async function issueVisit(linkId: string, lang: Lang): Promise<{ visitId: string; token: string }> {
  const { SESSION_SECRET } = await getEnv();
  const visitId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const exp = Date.now() + VISIT_TTL_MS;
  return { visitId, token: `${visitId}.${lang}.${exp}.${await sign(SESSION_SECRET, `${linkId}.${visitId}.${lang}.${exp}`)}` };
}

/** Returns the visit id and its language when the token is valid for this link, else null. */
export async function readVisit(linkId: string, token: unknown): Promise<{ visitId: string; lang: Lang } | null> {
  if (typeof token !== "string" || token.length > 120) return null;
  const [visitId, lang, exp, sig] = token.split(".");
  if (!visitId || !exp || !sig || !/^[a-f0-9]{20}$/.test(visitId) || !isLang(lang) || !(Number(exp) > Date.now())) return null;
  const { SESSION_SECRET } = await getEnv();
  if (!SESSION_SECRET) return null;
  const expected = await sign(SESSION_SECRET, `${linkId}.${visitId}.${lang}.${exp}`);
  if (expected.length !== sig.length) return null;
  let r = 0;
  for (let i = 0; i < sig.length; i++) r |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return r === 0 ? { visitId, lang } : null;
}
