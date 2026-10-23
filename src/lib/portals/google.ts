// Google has no way to prefill a review, so the best link is one that opens the "Write a review" box itself.
const WRITE_REVIEW = "https://search.google.com/local/writereview?placeid=";
const PLACE_ID = /^[A-Za-z0-9_-]{20,300}$/;

const HELP =
  "Paste your Place ID, or the review link from Google Business Profile → Ask for reviews (it looks like https://g.page/r/…/review).";

/** Turns a Place ID or a Google review link into a URL that opens Google's review box. */
export function toGoogleReviewUrl(raw: string): { url: string } | { error: string } {
  const input = raw.trim();
  if (!input) return { error: HELP };
  if (PLACE_ID.test(input)) return { url: WRITE_REVIEW + input };

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { error: HELP };
  }
  if (u.protocol !== "https:") return { error: "The link must start with https://" };
  const host = u.hostname.toLowerCase();

  if (host === "search.google.com" && u.pathname === "/local/writereview") {
    const id = u.searchParams.get("placeid") ?? "";
    return PLACE_ID.test(id) ? { url: WRITE_REVIEW + id } : { error: `That link has no valid Place ID. ${HELP}` };
  }
  // Business Profile's own share link: g.page/r/<code>/review
  const g = host === "g.page" ? /^\/r\/([A-Za-z0-9_-]+)(?:\/review)?\/?$/.exec(u.pathname) : null;
  if (g) return { url: `https://g.page/r/${g[1]}/review` };

  if (host === "maps.app.goo.gl" || host === "goo.gl" || /(^|\.)google\.[a-z.]+$/.test(host)) {
    return { error: `This link opens the map, not the review box. ${HELP}` };
  }
  return { error: HELP };
}
