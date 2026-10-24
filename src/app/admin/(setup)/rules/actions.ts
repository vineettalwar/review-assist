"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, brand } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { rulesFromText } from "@/lib/rules";
import { qs } from "../flash";

/** Saves the active client's rule set and genuine-experience mode. Only this client's drafts see these rules. */
export async function saveRules(formData: FormData) {
  await requireAdmin();
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const rules = {
    draft: rulesFromText(String(formData.get("draft") ?? "")),
    team: rulesFromText(String(formData.get("team") ?? "")),
  };
  const db = await getDb();
  await db
    .update(brand)
    .set({ rules: JSON.stringify(rules), strict: formData.get("strict") === "on", updatedAt: Date.now() })
    .where(eq(brand.id, active.id));
  revalidatePath("/admin/rules");
  revalidatePath("/admin/training");
  redirect("/admin/rules" + qs({ saved: "1" }));
}
