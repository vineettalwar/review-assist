import { createRemoteJWKSet, jwtVerify } from "jose";

/** Cached JWKS per team domain (module scope survives Worker isolates briefly). */
const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(teamDomain: string) {
  const base = teamDomain.replace(/\/$/, "");
  let set = jwksByTeam.get(base);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${base}/cdn-cgi/access/certs`));
    jwksByTeam.set(base, set);
  }
  return set;
}

/** True when production Access is configured (AUD set). Local/dev leaves AUD empty and uses password login. */
export function accessConfigured(aud: string | undefined, teamDomain: string | undefined): boolean {
  return Boolean(aud?.trim() && teamDomain?.trim());
}

export async function verifyAccessJwt(
  token: string | null | undefined,
  teamDomain: string,
  aud: string,
): Promise<boolean> {
  if (!token || !teamDomain || !aud) return false;
  const issuer = teamDomain.replace(/\/$/, "");
  try {
    await jwtVerify(token, jwks(issuer), { issuer, audience: aud });
    return true;
  } catch {
    return false;
  }
}

export function accessLogoutUrl(teamDomain: string, returnTo: string): string {
  const base = teamDomain.replace(/\/$/, "");
  return `${base}/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`;
}
