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

  /** Genuine-experience mode: a neutral ask instead of "your review is drafted". */
  askHeading: (firstName: string, brand: string) => string;
  askLede: (portal: string) => string;
  startHint: string;
  situationLabel: string;
  wordsLabel: string;
  wordsHint: string;
  tooShort: (min: number) => string;
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

    askHeading: (n, b) => `${n ? `Hi ${n}. ` : ""}How was your experience with ${b || "us"}?`,
    askLede: (portal) => `Positive, neutral or critical: honest feedback on ${portal} helps other customers. Rate it, tick what fits, and we’ll draft it from your answers only.`,
    startHint: "Pick a star rating to start your draft, or write your own here.",
    situationLabel: "Where, why, how long",
    wordsLabel: "In your own words (optional)",
    wordsHint: "Anything you noticed. We only use what you tick and write here.",
    tooShort: (min) => `This site needs at least ${min} characters. Add a little more about your experience.`,
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

    askHeading: (n, b) => `${n ? `${n}様、` : ""}${b || "当社"}のご利用はいかがでしたか？`,
    askLede: (portal) => `良い点も気になった点も、率直なご感想が${portal}で他のお客様の参考になります。評価と当てはまる項目を選ぶと、そのご回答だけをもとに下書きを作ります。`,
    startHint: "星を選ぶと下書きを作成します。ご自身で書いていただくこともできます。",
    situationLabel: "使った場所・目的・期間",
    wordsLabel: "ご自身の言葉で（任意）",
    wordsHint: "気づいたことがあればご記入ください。選んだ項目とここに書いた内容だけを使います。",
    tooShort: (min) => `この投稿先は${min}文字以上が必要です。ご体験をもう少し加えてください。`,
  },
  de: {
    ratingWords: ["Tippen zum Bewerten", "Schlecht", "Nicht gut", "Okay", "Gut", "Sehr gut"],
    heading: (n) => (n ? `Hallo ${n}, Ihr Bewertungsentwurf ist fertig.` : "Ihr Bewertungsentwurf ist fertig."),
    lede: (portal) => `Bewerten Sie Ihre Erfahrung, ändern Sie jedes Wort, und wir übergeben eine Kopie an ${portal}.`,
    reviewSiteFallback: "das Bewertungsportal",

    ratingLabel: "Ihre Bewertung",
    starLabel: (n) => `${n} ${n === 1 ? "Stern" : "Sterne"}`,
    highlightsLabel: "Was aufgefallen ist",

    draftLabel: "Ihr Bewertungsentwurf",
    sheetNo: (no) => `NR. ${no}`,
    stampCopied: "KOPIERT",
    carbonCopy: (no) => `NR. ${no} · KOPIE`,
    carbonTo: (portal) => (portal ? `AN ${portal.toUpperCase()}` : ""),
    lengthLabel: "Länge",
    short: "Kurz",
    detailed: "Ausführlich",
    editableLabel: "Ihre Bewertung, bearbeitbar",
    writingStatus: "Entwurf wird geschrieben…",
    newDraft: "Neuer Entwurf",
    writing: "Schreibt…",
    rewriteFor: (n) => `Für ${n} ${n === 1 ? "Stern" : "Sterne"} neu schreiben`,
    rewriteHighlights: "Mit dieser Auswahl neu schreiben",
    undo: "Rückgängig",
    count: (t) => {
      const n = words(t);
      return `${n} ${n === 1 ? "Wort" : "Wörter"}`;
    },
    draftError: "Neuer Entwurf nicht möglich. Ihr Text bleibt unverändert.",

    postLabel: "Bewertung veröffentlichen",
    detailsHeading: "Ihre Angaben",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    emailPlaceholder: "sie@beispiel.de",
    emailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    detailsToggle: "Name und E-Mail hinzufügen (optional)",
    contactOk: (brand) => `${brand} darf mich zu dieser Erfahrung kontaktieren.`,
    privacy: (brand) => `Optional. Nur ${brand} sieht diese Angaben, sie erscheinen nie in Ihrer Bewertung.`,
    brandFallback: "das Unternehmen",
    googleSteps: (r) => [
      r ? `Tippen Sie auf ${r} ${r === 1 ? "Stern" : "Sterne"}.` : "Tippen Sie auf Ihre Sterne.",
      "Halten Sie das Textfeld gedrückt und wählen Sie Einfügen.",
      "Tippen Sie auf Posten.",
    ],

    copyAndOpen: (portal) => `Kopieren & ${portal} öffnen`,
    orPostOn: "oder veröffentlichen auf",
    copyFallback: "Automatisches Kopieren hat nicht geklappt. Ihr Text ist oben markiert: gedrückt halten, dann Kopieren.",
    afterCopied: (portal) => `Kopiert. Fügen Sie den Text bei ${portal} ein.`,
    afterNotCopied: (portal) => `Kopieren Sie den Text und fügen Sie ihn bei ${portal} ein.`,
    afterThanks: (n) => `Wir haben es in einem neuen Tab geöffnet. Danke, dass Sie sich die Zeit nehmen${n ? `, ${n}` : ""}.`,
    openAgain: "Erneut öffnen",
    copyAgain: "Erneut kopieren",

    claimTo: (email) => `Wir senden es an ${email}.`,
    claimEmailLabel: "E-Mail-Adresse für den Versand",
    claimSend: "Senden",
    claimSent: "Gesendet. Bitte prüfen Sie Ihr Postfach.",
    claimError: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",

    footer: "Veröffentlichen Sie nur, was Ihrer echten Erfahrung entspricht.",

    inactiveTitle: "Dieser Link ist nicht aktiv.",
    inactiveBody: (brand) => `Er ist möglicherweise abgelaufen. Wenn Sie eine Bewertung schreiben möchten, bitten Sie ${brand} um einen neuen Link.`,
    inactiveBrandFallback: "das Unternehmen",

    askHeading: (n, b) => `${n ? `Hallo ${n}, w` : "W"}ie zufrieden waren Sie mit Ihrer Erfahrung mit ${b || "uns"}?`,
    askLede: (portal) => `Wir freuen uns über Ihr ehrliches Feedback bei ${portal}, ob positiv, neutral oder kritisch. Bewerten Sie, wählen Sie aus, was zutrifft, und wir formulieren einen Entwurf nur aus Ihren Angaben.`,
    startHint: "Wählen Sie eine Sternebewertung, um den Entwurf zu starten, oder schreiben Sie selbst.",
    situationLabel: "Wo, warum, wie lange",
    wordsLabel: "In Ihren eigenen Worten (optional)",
    wordsHint: "Was Ihnen aufgefallen ist. Wir verwenden nur, was Sie hier auswählen und schreiben.",
    tooShort: (min) => `Dieses Portal verlangt mindestens ${min} Zeichen. Ergänzen Sie bitte etwas mehr zu Ihrer Erfahrung.`,
  },
};

/** Copy for a language, falling back to English. */
export function reviewCopy(lang: Lang | string | null | undefined): ReviewCopy {
  return lang === "ja" ? REVIEW_COPY.ja : lang === "de" ? REVIEW_COPY.de : REVIEW_COPY.en;
}
