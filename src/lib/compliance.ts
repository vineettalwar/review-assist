import type { Portal } from "@/db/schema";

/** Portals whose terms forbid rewards for reviews. Incentives are always off for these. */
export const LOCKED_TYPES = ["google", "trustpilot", "amazon", "yelp", "facebook"] as const;

export function isLockedType(type: string): boolean {
  return (LOCKED_TYPES as readonly string[]).includes(type);
}

export function canIncentivize(portal: Pick<Portal, "type" | "allowsIncentives">): boolean {
  return !isLockedType(portal.type) && portal.allowsIncentives === true;
}

/** Call on every portal insert/update so a locked type can never carry allowsIncentives=true. */
export function normalizePortal<T extends { type: string; allowsIncentives?: boolean }>(
  portal: T,
): T & { allowsIncentives: boolean } {
  return { ...portal, allowsIncentives: isLockedType(portal.type) ? false : Boolean(portal.allowsIncentives) };
}

/**
 * Throws unless the portal allows incentives and this visit copied its review to that portal.
 * Claims are per visit (product links are shared), so the copy state comes from the visit row, not the link.
 */
export function assertClaimAllowed(
  visit: { portalId: string | null; copiedAt: number | null },
  portal: Pick<Portal, "id" | "type" | "allowsIncentives">,
): void {
  if (!canIncentivize(portal)) throw new Error("This portal does not allow rewards.");
  if (!visit.copiedAt || !visit.portalId) throw new Error("Copy your review first to claim the reward.");
  if (visit.portalId !== portal.id) throw new Error("This portal does not allow rewards.");
}
