import { NextResponse } from "next/server";
import { generateDraft, LinkInactiveError, VisitError } from "@/lib/generation";
import { clientIp } from "@/lib/ratelimit";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, visit, rating, highlightIds, length, variant, words } = b ?? {};
  const bad =
    typeof token !== "string" || !token || token.length > 64 ||
    typeof visit !== "string" || visit.length > 120 ||
    typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 5 ||
    (length !== "short" && length !== "detailed") ||
    typeof variant !== "number" || !Number.isInteger(variant) || variant < 0 || variant > 50 ||
    !Array.isArray(highlightIds) || highlightIds.length > 16 ||
    (words !== undefined && (typeof words !== "string" || words.length > 300)) ||
    !highlightIds.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64);
  if (bad) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const r = await generateDraft({
      token: token as string,
      visit: visit as string,
      ip: clientIp(request.headers),
      rating: rating as number,
      highlightIds: [...(highlightIds as string[])].sort(),
      length: length as "short" | "detailed",
      variant: variant as number,
      words: typeof words === "string" ? words : "",
    });
    return NextResponse.json({ text: r.text });
  } catch (e) {
    if (e instanceof VisitError) return NextResponse.json({ error: "This page has expired. Reload to get a new draft." }, { status: 410 });
    if (e instanceof LinkInactiveError) return NextResponse.json({ error: "Link not active" }, { status: 404 });
    return NextResponse.json({ error: "Could not generate a draft" }, { status: 500 });
  }
}
