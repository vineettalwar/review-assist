import type { DraftLength } from "./types";
import type { Lang } from "@/lib/i18n/languages";
import { pick, rng } from "./unique";

type Tone = "neutral" | "good" | "mixed" | "poor";

const tone = (r: number): Tone => (r === 0 ? "neutral" : r >= 4 ? "good" : r === 3 ? "mixed" : "poor");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const join = (a: string[]) => (a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : (a[0] ?? ""));
const lc = (s: string) => s.trim().toLowerCase();

// {n} = product name. Several options per slot; the seed picks one of each, so drafts differ between visits.
const EN = {
  open: {
    neutral: ["Some thoughts on {n}.", "I tried {n} recently.", "A quick note about {n}.", "Here's how {n} went for me.", "Sharing my experience with {n}.", "I've had a chance to try {n}."],
    good: ["Really good experience with {n}!", "I'm so happy with {n}.", "{N} turned out to be a great pick.", "So glad I went with {n}.", "{N} was even better than I hoped.", "Loving {n} so far.", "{N} has been a real treat.", "Honestly, I'm impressed with {n}.", "Can't complain one bit about {n}."],
    mixed: ["Kind of mixed feelings about {n}.", "{N} was fine, for the most part.", "{N} was okay, with a few catches.", "Some good, some not so good with {n}.", "{N} did the job, mostly.", "Not bad, not amazing. That's {n} for me."],
    poor: ["I was a bit disappointed with {n}.", "{N} didn't quite live up to what I hoped.", "{N} fell short for me, sadly.", "Not a great experience with {n} this time.", "I expected more from {n}.", "{N} let me down this time."],
  },
  neg: [
    (l: string[], many: boolean) => `The weak ${many ? "spots" : "spot"} for me ${many ? "were" : "was"} ${join(l)}.`,
    (l: string[]) => `Where it fell short for me was ${join(l)}.`,
    (l: string[]) => `My main issue was ${join(l)}.`,
    (l: string[]) => `What bothered me was ${join(l)}.`,
  ],
  posAfterNeg: [
    (l: string[]) => `On the plus side, I liked the ${join(l)}.`,
    (l: string[], many: boolean) => `To be fair, the ${join(l)} ${many ? "were" : "was"} good.`,
    (l: string[]) => `The ${join(l)} did make up for some of it.`,
  ],
  pos: [
    (l: string[]) => `What really stood out was the ${join(l)}.`,
    (l: string[]) => `The ${join(l)} stood out.`,
    (l: string[], many: boolean) => `The ${join(l)} ${many ? "were" : "was"} a highlight for me.`,
    (l: string[]) => `I especially appreciated the ${join(l)}.`,
    (l: string[]) => `Big plus for me was the ${join(l)}.`,
    (l: string[]) => `Loved the ${join(l)}.`,
  ],
  extra: {
    neutral: ["It was about what I expected.", "Nothing out of the ordinary to report.", "It did what it said it would.", "No real surprises either way."],
    good: ["Everything worked just like they said it would.", "It was exactly what I was told to expect.", "The whole thing felt really easy.", "I never had to chase anyone for anything.", "You can tell some real care went into it."],
    mixed: ["The core of it was solid, but not everything was.", "Some parts were solid, others less so.", "A few details could use more attention.", "It works, but it could be smoother."],
    poor: ["It didn't match what I expected going in.", "I came away with more questions than answers.", "It took more effort than it should have.", "I hope the details get more attention."],
  },
  close: {
    neutral: ["", "", "That's my take."],
    good: ["Would definitely recommend!", "Really happy I went with it.", "I'd pick it again in a heartbeat.", "Easy one to recommend.", "Thanks so much to the team!"],
    mixed: ["Some things could be better.", "There is room to improve.", "Worth a look, with expectations set.", "Hopefully it gets better."],
    poor: ["Sharing this so they can improve.", "Hope this helps them make it better.", "Hoping for better next time.", "I'd think twice before choosing it again."],
  },
};

// Japanese: {n} = product name. Polite です/ます, natural review register.
const JA = {
  open: {
    neutral: ["{n}を利用してみました。", "{n}についての感想です。", "先日{n}を試しました。", "{n}を使ってみた感想を書きます。"],
    good: ["{n}にとても満足しています。", "{n}を選んで本当によかったです。", "{n}、期待以上でした。", "{n}はとても良い体験でした。", "{n}、想像していたよりずっと良かったです。", "{n}に大満足です。"],
    mixed: ["{n}は全体的にはまずまずでした。", "{n}、良い点もあれば気になる点もありました。", "{n}は悪くはないのですが、少し惜しい印象です。", "{n}については正直なところ半々です。"],
    poor: ["{n}は残念ながら期待はずれでした。", "{n}には少しがっかりしました。", "{n}、思っていたものとは違いました。", "{n}は今回あまり満足できませんでした。"],
  },
  neg: [(l: string[]) => `特に${l.join("や")}が気になりました。`, (l: string[]) => `${l.join("と")}の点が残念でした。`, (l: string[]) => `${l.join("、")}については改善してほしいです。`],
  posAfterNeg: [(l: string[]) => `一方で、${l.join("や")}は良かったです。`, (l: string[]) => `ただ、${l.join("と")}には満足しています。`],
  pos: [(l: string[]) => `特に${l.join("や")}が印象に残りました。`, (l: string[]) => `${l.join("と")}がとても良かったです。`, (l: string[]) => `${l.join("、")}が特に気に入っています。`, (l: string[]) => `${l.join("や")}は期待どおりでした。`],
  extra: {
    neutral: ["おおむね想像していたとおりでした。", "特に大きな驚きはありませんでした。", "説明どおりの内容でした。"],
    good: ["説明どおりで安心できました。", "最初から最後までスムーズでした。", "細かいところまで丁寧だと感じました。", "迷わず使えたのも良かったです。"],
    mixed: ["基本は良いのですが、細かい部分が惜しいです。", "良いところと物足りないところがはっきりしていました。", "もう少し改善されるとさらに良いと思います。"],
    poor: ["思っていた以上に手間がかかりました。", "説明と少し違う印象を受けました。", "細かい部分にもう少し配慮がほしかったです。"],
  },
  close: {
    neutral: ["", "参考になれば幸いです。"],
    good: ["おすすめです。", "また利用したいと思います。", "ありがとうございました。", "人にもすすめたいです。"],
    mixed: ["今後に期待しています。", "改善されればまた利用したいです。", "参考になれば幸いです。"],
    poor: ["今後の改善に期待します。", "率直な感想として書きました。", "次回に期待したいと思います。"],
  },
};

/** Template writer used when no AI provider is connected. The seed varies wording between visits. */
export function demoGenerate(o: {
  productName: string;
  rating: number;
  highlights: { label: string; polarity: string }[];
  length: DraftLength;
  seed: string;
  lang?: Lang;
}): string {
  const r = rng(o.seed);
  const t = tone(o.rating);
  const raw = o.productName.trim();
  const negL = o.highlights.filter((h) => h.polarity === "neg").map((h) => h.label.trim());
  const posL = o.highlights.filter((h) => h.polarity !== "neg").map((h) => h.label.trim());

  if (o.lang === "ja") {
    const n = raw || "こちら";
    const parts = [pick(r, JA.open[t]).replace("{n}", n)];
    if (negL.length) parts.push(pick(r, JA.neg)(negL));
    if (posL.length) parts.push((negL.length || t === "poor" ? pick(r, JA.posAfterNeg) : pick(r, JA.pos))(posL));
    if (o.length === "detailed") parts.push(pick(r, JA.extra[t]));
    parts.push(pick(r, JA.close[t]));
    return parts.join("");
  }

  // Keep proper names (single capitalised word or internal capitals) as written; lower-case generic ones.
  const name = !raw ? "it" : /^[A-Z][a-z0-9]+$/.test(raw) || /[A-Z].*[A-Z]/.test(raw) ? `the ${raw}` : `the ${raw.toLowerCase()}`;
  const neg = negL.map(lc);
  const pos = posL.map(lc);
  const fill = (s: string) => s.replace("{N}", cap(name)).replace("{n}", name);
  const parts = [fill(pick(r, EN.open[t]))];
  if (neg.length) parts.push(pick(r, EN.neg)(neg, neg.length > 1));
  if (pos.length) parts.push((neg.length || t === "poor" ? pick(r, EN.posAfterNeg) : pick(r, EN.pos))(pos, pos.length > 1));
  if (o.length === "detailed") {
    const extras = [...EN.extra[t]];
    const a = pick(r, extras);
    parts.push(a);
    const b = pick(r, extras.filter((x) => x !== a));
    if (r() > 0.4) parts.push(b);
  }
  parts.push(pick(r, EN.close[t]));
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
