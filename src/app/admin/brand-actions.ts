"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, brand } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { setActiveBrandCookie } from "@/lib/brand";

/** Make `id` the active brand (cookie), then go to Links. Unknown ids are ignored. */
export async function switchBrand(id: string) {
  await requireAdmin();
  const db = await getDb();
  const [b] = await db.select({ id: brand.id }).from(brand).where(eq(brand.id, String(id))).limit(1);
  if (b) {
    await setActiveBrandCookie(b.id);
    revalidatePath("/admin", "layout");
  }
  redirect("/admin/links");
}
