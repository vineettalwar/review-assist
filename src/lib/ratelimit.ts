// Fixed-window rate limiting backed by D1. Fails open on DB errors so a counter hiccup never blocks real customers.
import { sql } from "drizzle-orm";
import { getDb, rateLimits } from "@/db";

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }> {
  const now = Date.now();
  try {
    const db = await getDb();
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt: now + windowMs })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN ${now + windowMs} ELSE ${rateLimits.resetAt} END`,
        },
      })
      .returning();
    if (!row) return { ok: true, retryAfterMs: 0 };
    return { ok: row.count <= limit, retryAfterMs: Math.max(0, row.resetAt - now) };
  } catch {
    return { ok: true, retryAfterMs: 0 };
  }
}

/** Best-effort client IP (Cloudflare sets cf-connecting-ip). */
export function clientIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  // x-forwarded-for is client-controlled; only trust it outside production (local dev).
  return process.env.NODE_ENV === "production" ? "unknown" : h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
