"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export type LoginState = { error?: string };

const WINDOW_MS = 15 * 60 * 1000;
const PER_IP = 8;
const GLOBAL = 60; // high enough that one attacker IP cannot lock the real admin out

/** Only same-origin admin paths: "/admin" or "/admin/...", "/admin?..." — never "//host", "/\host" or "/admin.evil". */
function safeNext(raw: string): string {
  const fallback = "/admin/links";
  if (!raw || raw.length > 500) return fallback;
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  if (!/^\/admin(?:[/?#]|$)/.test(raw)) return fallback;
  try {
    const base = "https://review-assist.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base || !/^\/admin(?:\/|$)/.test(u.pathname)) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

function wait(ms: number) {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many sign-in attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());
  // Count every attempt (not just failures) so guesses can't slip through between checks.
  const [perIp, global] = await Promise.all([
    rateLimit(`login:ip:${ip}`, PER_IP, WINDOW_MS),
    rateLimit("login:global", GLOBAL, WINDOW_MS),
  ]);
  if (!perIp.ok) return { error: wait(perIp.retryAfterMs) };
  if (!global.ok) return { error: wait(global.retryAfterMs) };

  const password = String(formData.get("password") ?? "").slice(0, 1000);
  if (!(await checkPassword(password))) return { error: "That password isn't right." };
  await createSession();
  redirect(safeNext(String(formData.get("next") ?? "")));
}
