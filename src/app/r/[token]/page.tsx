import type { Metadata } from "next";
import { headers } from "next/headers";
import { Review } from "@/components/review/Review";
import { Inactive } from "@/components/review/Inactive";
import { getLinkByToken, loadReviewData, markOpened, recordVisit } from "../resolve";
import { canIncentivize } from "@/lib/compliance";
import { generateDraft, preselectHighlights } from "@/lib/generation";
import { issueVisit } from "@/lib/visit";
import { chipLabel, marketLang, parseLanguages, pickLang } from "@/lib/i18n/languages";
import { getDb, brand, settings } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function brandNameForToken(token: string) {
  try {
    const link = await getLinkByToken(token);
    if (!link) return "";
    const db = await getDb();
    const [b] = await db.select().from(brand).where(eq(brand.id, link.brandId)).limit(1);
    return b?.name ?? "";
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const name = await brandNameForToken(token);
  return {
    title: name ? `Your review · ${name}` : "Your review",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ token }, sp, h] = await Promise.all([params, searchParams, headers()]);
  const db = await getDb();
  const [data, [s]] = await Promise.all([loadReviewData(token), db.select().from(settings).where(eq(settings.id, "default")).limit(1)]);
  const enabled = parseLanguages(s?.languages);
  const acceptLanguage = h.get("accept-language");

  if (!data) {
    return <Inactive brand={await brandNameForToken(token)} lang={pickLang(enabled, { query: sp.lang, acceptLanguage })} />;
  }
  const { link, highlights, portals, reward } = data;
  const strict = !!data.brand?.strict;
  // A product with a market is always reviewed in that market's language. Otherwise product links follow ?lang=,
  // then the browser; customer links keep the language they were made with.
  const lang =
    (link.kind === "product" ? marketLang(data.product?.market) : null) ??
    pickLang(enabled, {
      query: sp.lang,
      preferred: link.kind === "customer" ? link.language : null,
      acceptLanguage: link.kind === "product" ? acceptLanguage : null,
      fallback: data.brand?.defaultLanguage,
    });

  const visit = await issueVisit(link.id, lang);
  await Promise.all([
    link.status === "created" ? markOpened(link.id) : null,
    recordVisit({ id: visit.visitId, linkId: link.id, brandId: link.brandId, productId: link.productId, language: lang }).catch(() => {}),
  ]);

  const preselected = preselectHighlights(link.visitNotes, highlights).sort();
  // Not awaited: the page renders at once and the first draft streams in when the model finishes.
  // Genuine-experience mode writes nothing until the customer has rated.
  const initialDraft = strict ? Promise.resolve("") : generateDraft({ token, visit: visit.token, ip: h.get("cf-connecting-ip") ?? "local", rating: 0, highlightIds: preselected, length: "short", variant: 0 })
    .then((r) => r.text)
    .catch(() => "");

  return (
    <Review
      token={token}
      visit={visit.token}
      lang={lang}
      brandName={data.brand?.name ?? ""}
      customerName={link.kind === "customer" ? link.customerName : ""}
      strict={strict}
      highlights={highlights.map((x) => ({ id: x.id, label: chipLabel(x, lang), polarity: x.polarity, kind: x.kind }))}
      portals={portals.map((p) => ({ id: p.id, type: p.type, label: p.label, url: p.url, incentive: canIncentivize(p), minChars: p.minChars }))}
      reward={reward && reward.enabled && !strict ? { title: reward.title, description: reward.description } : null}
      initialDraft={initialDraft}
      initialSelected={preselected}
    />
  );
}
