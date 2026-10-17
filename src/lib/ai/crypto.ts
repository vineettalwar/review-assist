// AES-GCM for provider API keys at rest. The key is derived from AI_KEYS_SECRET (or SESSION_SECRET).
const enc = new TextEncoder();

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(secret: string) {
  if (!secret) throw new Error("AI_KEYS_SECRET or SESSION_SECRET must be set to store API keys.");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`review-assist/ai-keys/v1:${secret}`));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Returns "v1.<iv>.<ciphertext>" (base64). */
export async function encryptSecret(secret: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await derive(secret), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

/** Null when the value can't be decrypted (for example the secret changed). */
export async function decryptSecret(secret: string, value: string): Promise<string | null> {
  const [v, iv, ct] = value.split(".");
  if (v !== "v1" || !iv || !ct) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await derive(secret), unb64(ct));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
