import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { accessConfigured, verifyAccessJwt } from "@/lib/access";
import { createSession, isAuthed } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Review Assist" };

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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "" } = await searchParams;
  const dest = safeNext(next);
  const env = await getEnv();

  if (accessConfigured(env.CF_ACCESS_AUD, env.CF_ACCESS_TEAM_DOMAIN)) {
    const token = (await headers()).get("cf-access-jwt-assertion");
    if (await verifyAccessJwt(token, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD)) {
      await createSession();
      redirect(dest);
    }
    // Behind Access, unauthenticated users never reach here; show a short wait state.
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <p className="text-sm text-muted">Checking Cloudflare Access…</p>
      </div>
    );
  }

  if (await isAuthed()) redirect(dest);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex items-center gap-2.5 text-sm font-semibold">
          <div className="grid size-[26px] place-items-center rounded bg-ink text-[11px] font-bold text-white">R</div>
          Review Assist
        </div>
        <h1 className="mb-6 text-[36px] tracking-[-0.035em]">Admin</h1>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
