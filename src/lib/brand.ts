// Active brand for the admin. Stored in a cookie, validated against the DB once per request (layout and page share the result).
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, brand, settings, type Brand } from "@/db";

export const ACTIVE_BRAND_COOKIE = "ra_brand";

export const listBrands = cache(async (): Promise<Pick<Brand, "id" | "name" | "logoKey">[]> => {
  const db = await getDb();
  return db.select({ id: brand.id, name: brand.name, logoKey: brand.logoKey }).from(brand).orderBy(asc(brand.createdAt), asc(brand.name));
});

/** The brand Settings locks the admin to, or null when multi-brand switching is allowed. */
export const getFocusBrand = cache(async (): Promise<Brand | null> => {
  const db = await getDb();
  const [s] = await db.select({ focus: settings.focusBrandId }).from(settings).where(eq(settings.id, "default")).limit(1);
  if (!s?.focus) return null;
  const [b] = await db.select().from(brand).where(eq(brand.id, s.focus)).limit(1);
  return b ?? null;
});

/** The brand the admin is working on: the focus brand when set, else the cookie's, else the first. Null only when none exist. */
export const getActiveBrand = cache(async (): Promise<Brand | null> => {
  const db = await getDb();
  const focus = await getFocusBrand();
  if (focus) return focus;
  const wanted = (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value;
  if (wanted) {
    const [b] = await db.select().from(brand).where(eq(brand.id, wanted)).limit(1);
    if (b) return b;
  }
  const [first] = await db.select().from(brand).orderBy(asc(brand.createdAt), asc(brand.name)).limit(1);
  return first ?? null;
});

/** Like getActiveBrand, but sends the admin to onboarding when no brand exists yet. */
export async function requireActiveBrand(): Promise<Brand> {
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  return b;
}

export async function setActiveBrandCookie(id: string) {
  (await cookies()).set(ACTIVE_BRAND_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
