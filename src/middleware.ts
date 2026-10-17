import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { accessConfigured, verifyAccessJwt } from "@/lib/access";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const { env } = await getCloudflareContext({ async: true });
  const e = env as unknown as Record<string, string | undefined>;
  const team = (e.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const aud = (e.CF_ACCESS_AUD ?? "").trim();

  if (accessConfigured(aud, team)) {
    const token = req.headers.get("cf-access-jwt-assertion");
    if (await verifyAccessJwt(token, team, aud)) return NextResponse.next();
    // Access at the edge should have blocked this; fail closed if JWT missing/invalid.
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const secret = e.SESSION_SECRET ?? "";
  if (await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
