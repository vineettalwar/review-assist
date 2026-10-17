"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getActiveBrand } from "@/lib/brand";
import { getDb, portals, products, highlights, productPortals, examples, links } from "@/db";
import { qs } from "../flash";
import { csvToProducts } from "./csv";

type HL = { id?: string; label: string; labelJa: string; polarity: "pos" | "neg" | "both" };

function parseHighlights(raw: string): HL[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((h) => ({
        id: typeof h.id === "string" && h.id ? h.id : undefined,
        label: String(h.label ?? "").trim().slice(0, 60),
        labelJa: String(h.labelJa ?? "").trim().slice(0, 40),
        polarity: (["pos", "neg", "both"].includes(h.polarity) ? h.polarity : "pos") as HL["polarity"],
      }))
      .filter((h) => h.label);
  } catch {
    return [];
  }
}

async function activeOrRedirect() {
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  return active;
}

export async function saveProduct(id: string, formData: FormData) {
  await requireAdmin();
  const active = await activeOrRedirect();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const long = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 6000);
  const isNew = id === "new";
  const name = str("name");
  const back = `/admin/products/${id}`;
  if (!name) redirect(back + qs({ error: "Give the product a name." }));

  const db = await getDb();
  const now = Date.now();
  const pid = isNew ? crypto.randomUUID() : id;
  const values = {
    name,
    category: str("category"),
    knowledge: long("knowledge"),
    avoid: long("avoid"),
    audience: long("audience"),
    experience: long("experience"),
    praise: long("praise"),
    concerns: long("concerns"),
    url: str("url").slice(0, 500),
    active: formData.get("active") === "1",
    updatedAt: now,
  };
  if (isNew) await db.insert(products).values({ id: pid, brandId: active.id, createdAt: now, ...values });
  else {
    const [ex] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, pid), eq(products.brandId, active.id)));
    if (!ex) redirect("/admin/products" + qs({ error: "That product no longer exists." }));
    await db.update(products).set(values).where(and(eq(products.id, pid), eq(products.brandId, active.id)));
  }

  // Highlights: keep ids stable (draft cache keys use them), delete removed, insert new, update the rest.
  const list = parseHighlights(String(formData.get("highlights") ?? "[]"));
  const existing = await db.select().from(highlights).where(eq(highlights.productId, pid));
  const keep = new Set(list.map((h) => h.id).filter(Boolean) as string[]);
  const gone = existing.filter((h) => !keep.has(h.id)).map((h) => h.id);
  if (gone.length) await db.delete(highlights).where(inArray(highlights.id, gone));
  const existingIds = new Set(existing.map((h) => h.id));
  const writes = list.map((h, i) =>
    h.id && existingIds.has(h.id)
      ? db.update(highlights).set({ label: h.label, labelJa: h.labelJa, polarity: h.polarity, sort: i }).where(eq(highlights.id, h.id))
      : db.insert(highlights).values({ id: crypto.randomUUID(), productId: pid, label: h.label, labelJa: h.labelJa, polarity: h.polarity, sort: i }),
  );
  if (writes.length) await db.batch(writes as [(typeof writes)[number], ...(typeof writes)[number][]]);

  // Portal overrides: replace set.
  const mine = await db.select({ id: portals.id }).from(portals).where(eq(portals.brandId, active.id));
  const okPortals = new Set(mine.map((x) => x.id));
  const portalIds = formData.getAll("portal").map(String).filter((x) => okPortals.has(x));
  await db.delete(productPortals).where(eq(productPortals.productId, pid));
  if (portalIds.length) await db.insert(productPortals).values(portalIds.map((portalId) => ({ productId: pid, portalId })));

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${pid}`);
  revalidatePath("/admin/training");
  redirect(`/admin/products/${pid}` + qs({ saved: "1" }));
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const active = await activeOrRedirect();
  const db = await getDb();
  const [own] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, id), eq(products.brandId, active.id)));
  if (!own) redirect("/admin/products" + qs({ error: "That product no longer exists." }));
  const used = await db.select({ id: links.id }).from(links).where(and(eq(links.productId, id), eq(links.brandId, active.id))).limit(1);
  if (used.length) {
    redirect(`/admin/products/${id}` + qs({ error: "This product has review links. Mark it inactive instead of deleting it." }));
  }
  await db.delete(highlights).where(eq(highlights.productId, id));
  await db.delete(productPortals).where(eq(productPortals.productId, id));
  await db.delete(examples).where(and(eq(examples.productId, id), eq(examples.brandId, active.id)));
  await db.delete(products).where(and(eq(products.id, id), eq(products.brandId, active.id)));
  revalidatePath("/admin/products");
  revalidatePath("/admin/training");
  redirect("/admin/products" + qs({ saved: "Product deleted." }));
}

export async function importProducts(formData: FormData) {
  await requireAdmin();
  const active = await activeOrRedirect();
  let text = String(formData.get("csv") ?? "");
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) redirect("/admin/products" + qs({ error: "CSV file must be 1MB or smaller." }));
    text = await file.text();
  }
  const rows = csvToProducts(text);
  if (!rows.length) redirect("/admin/products" + qs({ error: "No products found. Use columns: name, category, knowledge." }));
  const db = await getDb();
  const now = Date.now();
  const vals = rows.slice(0, 500).map((r) => ({ id: crypto.randomUUID(), brandId: active.id, ...r, avoid: "", active: true, createdAt: now, updatedAt: now }));
  // D1 caps bound parameters per statement, so insert in small chunks.
  for (let i = 0; i < vals.length; i += 8) await db.insert(products).values(vals.slice(i, i + 8));
  revalidatePath("/admin/products");
  revalidatePath("/admin/training");
  redirect("/admin/products" + qs({ saved: `Imported ${Math.min(rows.length, 500)} product${rows.length === 1 ? "" : "s"}.` }));
}
