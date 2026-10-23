import type { Lang } from "./languages";

/** Every customer-visible string on the review page (/r/[token]) and the inactive-link page. */
export type ReviewCopy = {
  /** Index 0 is the unrated prompt, 1–5 the star words. */
  ratingWords: readonly [string, string, string, string, string, string];
  heading: (firstName: string) => string;
  lede: (portal: string) => string;
  reviewSiteFallback: string;

  ratingLabel: string;
  starLabel: (n: number) => string;
  highlightsLabel: string;

  draftLabel: string;
  sheetNo: (no: string) => string;
  stampCopied: string;
  carbonCopy: (no: string) => string;
  carbonTo: (portal: string) => string;
  lengthLabel: string;
  short: string;
  detailed: string;
  editableLabel: string;
  writingStatus: string;
  newDraft: string;
  writing: string;
  rewriteFor: (stars: number) => string;
  rewriteHighlights: string;
  undo: string;
  count: (text: string) => string;
  draftError: string;

  postLabel: string;
  detailsHeading: string;
  nameLabel: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailInvalid: string;
  detailsToggle: string;
  contactOk: (brand: string) => string;
  privacy: (brand: string) => string;
  brandFallback: string;
  /** Google can't be prefilled, so after copying we say exactly what to do there. */
  googleSteps: (rating: number) => [string, string, string];

  copyAndOpen: (portal: string) => string;
  orPostOn: string;
  copyFallback: string;
  afterCopied: (portal: string) => string;
  afterNotCopied: (portal: string) => string;
  afterThanks: (firstName: string) => string;
  openAgain: string;
  copyAgain: string;

  claimTo: (email: string) => string;
  claimEmailLabel: string;
  claimSend: string;
  claimSent: string;
  claimError: string;

  footer: string;

  inactiveTitle: string;
  inactiveBody: (brand: string) => string;
  inactiveBrandFallback: string;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const chars = (text: string) => Array.from(text.replace(/\s/g, "")).length;

export const REVIEW_COPY: Record<Lang, ReviewCopy> = {
  en: {
    ratingWords: ["Tap to rate", "Poor", "Not great", "Okay", "Good", "Great"],
    heading: (n) => (n ? `Hi ${n}. Your review is drafted.` : "Your review is drafted."),
    lede: (portal) => `Rate your experience, change any word, and we’ll hand a copy to ${portal}.`,
    reviewSiteFallback: "the review site",

    ratingLabel: "Your rating",
    starLabel: (n) => `${n} star${n === 1 ? "" : "s"}`,
    highlightsLabel: "What stood out",

    draftLabel: "Your review draft",
    sheetNo: (no) => `NO. ${no}`,
    stampCopied: "COPIED",
    carbonCopy: (no) => `NO. ${no} · COPY`,
    carbonTo: (portal) => (portal ? `TO ${portal.toUpperCase()}` : ""),
    lengthLabel: "Length",
    short: "Short",
    detailed: "Detailed",
    editableLabel: "Your review, editable",
    writingStatus: "Writing your draft…",
    newDraft: "New draft",
    writing: "Writing…",
    rewriteFor: (n) => `Rewrite for ${n} star${n === 1 ? "" : "s"}`,
    rewriteHighlights: "Rewrite with these highlights",
    undo: "Undo",
    count: (t) => {
      const n = words(t);
      return `${n} word${n === 1 ? "" : "s"}`;
    },
    draftError: "Couldn’t write a new draft. Your text is unchanged.",

    postLabel: "Post your review",
    detailsHeading: "Your details",
    nameLabel: "Name",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    emailInvalid: "Enter a valid email address.",
    detailsToggle: "Add your name & email (optional)",
    contactOk: (brand) => `It’s okay for ${brand} to contact me about this visit.`,
    privacy: (brand) => `Optional. Only ${brand} sees these, and they are never added to your review.`,
    brandFallback: "the business",
    googleSteps: (r) => [
      r ? `Tap ${r} star${r === 1 ? "" : "s"}.` : "Tap your stars.",
      "Press and hold the text box, then Paste.",
      "Tap Post.",
    ],

    copyAndOpen: (portal) => `Copy & open ${portal}`,
    orPostOn: "or post on",
    copyFallback: "Couldn’t copy automatically. Your review is selected above: press and hold, then Copy.",
    afterCopied: (portal) => `Copied. Paste it on ${portal}.`,
    afterNotCopied: (portal) => `Copy it, then paste it on ${portal}.`,
    afterThanks: (n) => `We opened it in a new tab. Thanks for taking a minute${n ? `, ${n}` : ""}.`,
    openAgain: "Open again",
    copyAgain: "Copy again",

    claimTo: (email) => `We’ll send it to ${email}.`,
    claimEmailLabel: "Email to send it to",
    claimSend: "Send",
    claimSent: "Sent. Check your inbox.",
    claimError: "Something went wrong. Try again.",

    footer: "Only post what reflects your real experience.",

    inactiveTitle: "This link isn’t active.",
    inactiveBody: (brand) => `It may have expired. If you meant to leave a review, ask ${brand} for a new link.`,
    inactiveBrandFallback: "the business",
  },
  ja: {
    ratingWords: ["タップして評価", "不満", "やや不満", "ふつう", "満足", "大満足"],
    heading: (n) => (n ? `${n}様、レビューの下書きができました。` : "レビューの下書きができました。"),
    lede: (portal) => `星で評価して、文章は自由に直してください。仕上がったら${portal}へコピーしてお渡しします。`,
    reviewSiteFallback: "レビューサイト",

    ratingLabel: "評価",
    starLabel: (n) => `星${n}つ`,
    highlightsLabel: "よかった点・気になった点",

    draftLabel: "レビューの下書き",
    sheetNo: (no) => `NO. ${no}`,
    stampCopied: "コピー済",
    carbonCopy: (no) => `NO. ${no}・控え`,
    carbonTo: (portal) => (portal ? `${portal}へ` : ""),
    lengthLabel: "文章の長さ",
    short: "短め",
    detailed: "詳しく",
    editableLabel: "レビュー本文（編集できます）",
    writingStatus: "下書きを作成しています…",
    newDraft: "別の文案",
    writing: "作成中…",
    rewriteFor: (n) => `星${n}つの内容で書き直す`,
    rewriteHighlights: "選んだ項目で書き直す",
    undo: "元に戻す",
    count: (t) => `${chars(t)}文字`,
    draftError: "新しい文案を作成できませんでした。本文はそのままです。",

    postLabel: "レビューを投稿",
    detailsHeading: "お客様情報",
    nameLabel: "お名前",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@email.com",
    emailInvalid: "メールアドレスの形式をご確認ください。",
    detailsToggle: "お名前・メールアドレスを追加（任意）",
    contactOk: (brand) => `今回のご利用について${brand}から連絡を受け取ることに同意します。`,
    privacy: (brand) => `任意です。${brand}のみが確認し、レビューに掲載されることはありません。`,
    brandFallback: "販売元",
    googleSteps: (r) => [
      r ? `星${r}つをタップします。` : "星をタップします。",
      "入力欄を長押しして「貼り付け」を選びます。",
      "「投稿」をタップします。",
    ],

    copyAndOpen: (portal) => `コピーして${portal}を開く`,
    orPostOn: "ほかの投稿先：",
    copyFallback: "自動でコピーできませんでした。上の本文を選択してありますので、長押しして「コピー」を選んでください。",
    afterCopied: (portal) => `コピーしました。${portal}に貼り付けてください。`,
    afterNotCopied: (portal) => `本文をコピーして、${portal}に貼り付けてください。`,
    afterThanks: (n) =>
      `新しいタブで開きました。${n ? `${n}様、` : ""}お時間をいただきありがとうございます。`,
    openAgain: "もう一度開く",
    copyAgain: "もう一度コピー",

    claimTo: (email) => `${email} 宛にお送りします。`,
    claimEmailLabel: "送付先メールアドレス",
    claimSend: "受け取る",
    claimSent: "送信しました。メールをご確認ください。",
    claimError: "エラーが発生しました。もう一度お試しください。",

    footer: "実際のご体験に基づく内容のみ投稿してください。",

    inactiveTitle: "このリンクは現在ご利用いただけません。",
    inactiveBody: (brand) =>
      `有効期限が切れている可能性があります。レビューをご投稿いただける場合は、${brand}に新しいリンクをお問い合わせください。`,
    inactiveBrandFallback: "販売元",
  },
};

/** Copy for a language, falling back to English. */
export function reviewCopy(lang: Lang | string | null | undefined): ReviewCopy {
  return lang === "ja" ? REVIEW_COPY.ja : REVIEW_COPY.en;
}
