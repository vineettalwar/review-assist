/** Stable 4-digit "sheet number" for a link token, shown on the customer page and in admin. */
export function sheetNo(token: string) {
  let h = 0;
  for (const c of token) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "·";
}
