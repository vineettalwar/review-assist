"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb, settings, brand } from "@/db";
import { isLang } from "@/lib/i18n/languages";
import { setActiveBrandCookie } from "@/lib/brand";
import { PROVIDERS, connectProvider, disconnectProvider, isProviderId, retestProvider, setActiveProvider, setProviderModel } from "@/lib/ai";
import { qs } from "../flash";

const back = (p: Record<string, string>): never => redirect("/admin/settings" + qs(p));

function readProvider(formData: FormData) {
  const id = formData.get("provider");
  if (!isProviderId(id)) back({ error: "Unknown provider." });
  return id as keyof typeof PROVIDERS;
}

function readModel(formData: FormData, id: keyof typeof PROVIDERS) {
  const model = String(formData.get("model") ?? "").trim() || PROVIDERS[id].defaultModel;
  if (model.length > 120 || /\s/.test(model)) back({ error: "Enter a valid model id." });
  return model;
}

/** Accepts a key copied as a header or env line: strips "Authorization:", "Bearer", NAME=, quotes and stray whitespace. */
function cleanKey(raw: string) {
  return raw
    .trim()
    .replace(/^[A-Z0-9_]+\s*=\s*/, "")
    .replace(/^authorization\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, "");
}

export async function connectAi(formData: FormData) {
  await requireAdmin();
  const id = readProvider(formData);
  const key = cleanKey(String(formData.get("apiKey") ?? ""));
  if (key.length < 12 || key.length > 300 || /\s/.test(key)) back({ error: `Paste a valid ${PROVIDERS[id].label} API key. Paste the key only, without spaces or line breaks.` });
  const model = readModel(formData, id);
  const r = await connectProvider(id, key, model);
  revalidatePath("/admin", "layout");
  if (!r.ok) back({ error: `${PROVIDERS[id].label} not connected. ${r.error}` });
  back({ saved: `${PROVIDERS[id].label} connected and tested with ${model}.` });
}

export async function saveAiModel(formData: FormData) {
  await requireAdmin();
  const id = readProvider(formData);
  const model = readModel(formData, id);
  const r = await setProviderModel(id, model);
  revalidatePath("/admin/settings");
  if (!r.ok) back({ error: `Model not changed. ${r.error}` });
  back({ saved: `${PROVIDERS[id].label} now uses ${model}.` });
}

export async function testAi(formData: FormData) {
  await requireAdmin();
  const id = readProvider(formData);
  const r = await retestProvider(id);
  revalidatePath("/admin/settings");
  if (!r.ok) back({ error: `${PROVIDERS[id].label} test failed. ${r.error}` });
  back({ saved: `${PROVIDERS[id].label} is working.` });
}

export async function activateAi(formData: FormData) {
  await requireAdmin();
  const id = readProvider(formData);
  await setActiveProvider(id);
  revalidatePath("/admin", "layout");
  back({ saved: `${PROVIDERS[id].label} now writes drafts and scans.` });
}

export async function disconnectAi(formData: FormData) {
  await requireAdmin();
  const id = readProvider(formData);
  await disconnectProvider(id);
  const db = await getDb();
  const [s] = await db.select().from(settings).where(eq(settings.id, "default"));
  if (s?.provider === id) await setActiveProvider("");
  revalidatePath("/admin", "layout");
  back({ saved: `${PROVIDERS[id].label} disconnected. Its key was deleted.` });
}

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const temp = Number(formData.get("temperature"));
  const max = Number(formData.get("maxTokens"));
  if (!Number.isFinite(temp) || temp < 0 || temp > 1.5) back({ error: "Temperature must be between 0 and 1.5." });
  if (!Number.isInteger(max) || max < 100 || max > 1000) back({ error: "Max tokens must be a whole number from 100 to 1000." });
  const values = { temperature: temp, maxTokens: max, systemPromptExtra: String(formData.get("systemPromptExtra") ?? "").trim().slice(0, 4000) };
  const db = await getDb();
  const [existing] = await db.select().from(settings).where(eq(settings.id, "default"));
  if (existing) await db.update(settings).set(values).where(eq(settings.id, "default"));
  else await db.insert(settings).values({ id: "default", ...values });
  revalidatePath("/admin/settings");
  back({ saved: "1" });
}

async function upsertSettings(values: Partial<typeof settings.$inferInsert>) {
  const db = await getDb();
  const [existing] = await db.select({ id: settings.id }).from(settings).where(eq(settings.id, "default"));
  if (existing) await db.update(settings).set(values).where(eq(settings.id, "default"));
  else await db.insert(settings).values({ id: "default", ...values });
}

export async function saveLanguages(formData: FormData) {
  await requireAdmin();
  const langs = [...new Set(formData.getAll("lang").map(String).filter(isLang))];
  if (!langs.length) back({ error: "Keep at least one review language on." });
  await upsertSettings({ languages: JSON.stringify(langs) });
  revalidatePath("/admin", "layout");
  back({ saved: "Review languages saved." });
}

export async function saveFocus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("focusBrandId") ?? "");
  if (id) {
    const db = await getDb();
    const [b] = await db.select({ id: brand.id }).from(brand).where(eq(brand.id, id)).limit(1);
    if (!b) back({ error: "That brand no longer exists." });
    await setActiveBrandCookie(id);
  }
  await upsertSettings({ focusBrandId: id });
  revalidatePath("/admin", "layout");
  back({ saved: id ? "The admin now works on one brand." : "Brand switching is on." });
}
