import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accessConfigured, accessLogoutUrl } from "@/lib/access";
import { destroySession } from "@/lib/auth";
import { getActiveBrand, getFocusBrand, listBrands } from "@/lib/brand";
import { getEnv } from "@/lib/env";
import { AdminShell } from "./AdminShell";

export const metadata: Metadata = { title: "Review Assist Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await destroySession();
  const env = await getEnv();
  if (accessConfigured(env.CF_ACCESS_AUD, env.CF_ACCESS_TEAM_DOMAIN)) {
    redirect(accessLogoutUrl(env.CF_ACCESS_TEAM_DOMAIN, `${env.APP_URL}/admin/login`));
  }
  redirect("/admin/login");
}

async function loadBrand() {
  try {
    const [brands, active, focus] = await Promise.all([listBrands(), getActiveBrand(), getFocusBrand()]);
    return {
      locked: Boolean(focus),
      brands: brands.map((x) => ({ id: x.id, name: x.name })),
      activeId: active?.id ?? null,
      name: active?.name || (active ? "Untitled brand" : "No brand yet"),
      hasLogo: Boolean(active?.logoKey),
    };
  } catch {
    // Login page renders before a session exists; never let a DB hiccup break the shell.
    return { locked: false, brands: [], activeId: null, name: "Your business", hasLogo: false };
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const b = await loadBrand();
  return (
    <AdminShell logout={logout} brandName={b.name} hasLogo={b.hasLogo} brands={b.brands} activeId={b.activeId} locked={b.locked}>
      {children}
    </AdminShell>
  );
}
