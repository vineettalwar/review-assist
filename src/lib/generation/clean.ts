// Last pass on every draft before a customer sees it: removes the tells that make text read as machine-written.

const CJK = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

/** Removes em and en dashes (and spaced hyphens used as dashes), semicolons between clauses, quotes around the whole text, and stray spacing. */
export function humanize(text: string): string {
  let t = text.trim().replace(/^["“'「]+|["”'」]+$/g, "").trim();
  if (CJK.test(t)) {
    t = t.replace(/\s*[—–―]{2,}\s*/g, "、").replace(/\s*[—–―]\s*/g, "、");
    return t.replace(/、([。！？])/g, "$1").replace(/、{2,}/g, "、").replace(/^、|、$/g, "");
  }
  t = t
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2") // 3–5 → 3 to 5
    .replace(/\s*[—–―]+\s*/g, ", ") // aside — like this — becomes commas
    .replace(/\s+-{1,2}\s+/g, ", ") // spaced hyphen used as a dash
    .replace(/\s*;\s+(\p{Ll})/gu, (_, c: string) => ". " + c.toUpperCase()) // semicolons read as written-by-AI
    .replace(/,\s*([.!?,;:])/g, "$1")
    .replace(/^,\s*/, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");
  return t.trim();
}
