// Web Crypto HMAC session token, usable from middleware (edge) and server code.
export const SESSION_COOKIE = "ra_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let s = "";
  for (const b of sig) s += b.toString(16).padStart(2, "0");
  return s;
}

export async function signSession(secret: string, expiresAt: number) {
  const payload = String(expiresAt);
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(secret: string, value: string | undefined | null) {
  if (!secret || !value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(secret, payload);
  if (expected.length !== sig.length) return false;
  let r = 0;
  for (let i = 0; i < sig.length; i++) r |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return r === 0 && Number(payload) > Date.now();
}
