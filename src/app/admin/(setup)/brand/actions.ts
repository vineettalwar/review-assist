"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, brand } from "@/db";
import { getR2 } from "@/lib/env";
import { getActiveBrand } from "@/lib/brand";
import { LANGUAGES, VOICES } from "../constants";
import { qs } from "../flash";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function saveBrand(formData: FormData) {
  await requireAdmin();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const name = str("name");
  if (!name) redirect("/admin/brand" + qs({ error: "Give your brand a name." }));
  const voice = VOICES.find((v) => v.value === str("voice"))?.value ?? "warm";
  const lang = LANGUAGES.find((l) => l.value === str("defaultLanguage"))?.value ?? "en";

  const db = await getDb();
  const [existing] = await db.select().from(brand).where(eq(brand.id, active.id));
  let logoKey = existing?.logoKey ?? null;

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = TYPES[file.type];
    if (!ext) redirect("/admin/brand" + qs({ error: "Logo must be PNG, JPG or WebP." }));
    if (file.size > 1024 * 1024) redirect("/admin/brand" + qs({ error: "Logo must be 1MB or smaller." }));
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Trust the file's bytes, not the browser's declared type.
    const sniffed =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? "image/png"
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "image/webp"
      : "";
    if (!sniffed) redirect("/admin/brand" + qs({ error: "That file isn't a PNG, JPG or WebP image." }));
    const r2 = await getR2();
    const key = `logo/${active.id}/${crypto.randomUUID()}.${TYPES[sniffed]}`;
    await r2.put(key, bytes, { httpMetadata: { contentType: sniffed } });
    if (logoKey) await r2.delete(logoKey).catch(() => {});
    logoKey = key;
  } else if (formData.get("removeLogo") === "1" && logoKey) {
    const r2 = await getR2();
    await r2.delete(logoKey).catch(() => {});
    logoKey = null;
  }

  const values = {
    name,
    website: str("website").slice(0, 300),
    about: str("about").slice(0, 2000),
    audience: str("audience").slice(0, 2000),
    facts: str("facts").slice(0, 6000),
    voice,
    voiceNotes: str("voiceNotes").slice(0, 2000),
    wordsToAvoid: str("wordsToAvoid").slice(0, 2000),
    defaultLanguage: lang,
    logoKey,
    updatedAt: Date.now(),
  };
  await db.update(brand).set(values).where(eq(brand.id, active.id));

  revalidatePath("/admin/brand");
  redirect("/admin/brand" + qs({ saved: "1" }));
}
