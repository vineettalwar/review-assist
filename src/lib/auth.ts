import { cookies, headers } from "next/headers";
import { accessConfigured, verifyAccessJwt } from "@/lib/access";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession } from "@/lib/session";

export { SESSION_COOKIE };

const enc = new TextEncoder();

async function digest(v: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v)));
}

/** Compares SHA-256 digests (always 32 bytes) so neither timing nor early exit reveals the secret's length or content. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const { ADMIN_PASSWORD } = await getEnv();
  const ok = await safeEqual(input, ADMIN_PASSWORD);
  return ADMIN_PASSWORD.length > 0 && ok;
}

export async function createSession() {
  const { SESSION_SECRET } = await getEnv();
  const value = await signSession(SESSION_SECRET, Date.now() + SESSION_TTL_MS);
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function accessOk(): Promise<boolean> {
  const { CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN } = await getEnv();
  if (!accessConfigured(CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN)) return false;
  const token = (await headers()).get("cf-access-jwt-assertion");
  return verifyAccessJwt(token, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD);
}

export async function isAuthed(): Promise<boolean> {
  if (await accessOk()) return true;
  const { SESSION_SECRET, CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN } = await getEnv();
  // Production behind Access: session alone is not enough (no password path).
  if (accessConfigured(CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN)) return false;
  const v = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(SESSION_SECRET, v);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Call first in every admin server action and admin route handler. Middleware only guards page
 * navigations under /admin; server actions are POSTs that can be replayed against any page, so each
 * action must check on its own. Throws UnauthorizedError (route handlers can catch it and return 401).
 */
export async function requireAdmin(): Promise<void> {
  let ok = false;
  try {
    ok = await isAuthed();
  } catch {
    ok = false; // env/cookie read failure: fail closed
  }
  if (!ok) throw new UnauthorizedError();
}
