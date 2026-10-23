"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sheetNo, initials } from "@/lib/sheet";
import { reviewCopy } from "@/lib/i18n/review";
import s from "./review.module.css";

type Highlight = { id: string; label: string; polarity: "pos" | "neg" | "both" };
type PortalView = { id: string; type: string; label: string; url: string; incentive: boolean };
type Props = {
  token: string;
  /** Signed visit token; sent as `visit` in every POST body. */
  visit: string;
  lang: "en" | "ja";
  brandName: string;
  customerName: string;
  highlights: Highlight[];
  portals: PortalView[];
  reward: { title: string; description: string } | null;
  /** Streamed from the server; "" means generation failed and we fetch one client-side. */
  initialDraft: Promise<string>;
  initialSelected: string[];
};

// gsap is loaded after mount so it stays out of the initial bundle.
type Gsap = typeof import("gsap").gsap;
type Tween = ReturnType<Gsap["to"]>;
let gsapPromise: Promise<Gsap> | null = null;
const loadGsap = () => (gsapPromise ??= import("gsap").then((m) => m.gsap));

const STAR = "M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.27 6.38L12 17.05 6.31 20.23l1.27-6.38L2.8 9.45l6.45-.75z";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 80;
const EMAIL_MAX = 254;
const tone = (r: number) => (r === 0 ? "neutral" : r >= 4 ? "good" : r === 3 ? "mixed" : "poor");

export function Review(p: Props) {
  const t = reviewCopy(p.lang);
  const ja = p.lang === "ja";

  const reduceRef = useRef(false);
  const gsapRef = useRef<Gsap | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const carbonTextRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLElement>(null);
  const carbonRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const rewardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const claimEmailRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<string[]>(p.initialSelected);
  const [len, setLen] = useState<"short" | "detailed">("short");
  const [variant, setVariant] = useState(0);
  const [count, setCount] = useState(() => t.count(""));
  const [waiting, setWaiting] = useState(true); // no draft text has arrived yet
  const [writing, setWriting] = useState(true);
  const [error, setError] = useState("");
  const [suggest, setSuggest] = useState<"" | "rewrite" | "undo">("");
  const [chosen, setChosen] = useState<PortalView | null>(null);
  const [copyOk, setCopyOk] = useState(true);
  const [postedN, setPostedN] = useState(0);
  const [name, setName] = useState(() => p.customerName.trim().slice(0, NAME_MAX));
  const [email, setEmail] = useState("");
  const [detailErr, setDetailErr] = useState({ name: "", email: "" });
  // Name and email are optional; the fields stay collapsed so the default path is rate, copy, post.
  const [showDetails, setShowDetails] = useState(false);
  const [contactOk, setContactOk] = useState(false);
  // Whether an email came with the copy; if not, the reward claim asks for one itself.
  const [emailGiven, setEmailGiven] = useState(false);
  const [claimState, setClaimState] = useState<"idle" | "busy" | "sent">("idle");
  const [claimErr, setClaimErr] = useState("");

  const edited = useRef(false);
  const lastWritten = useRef("");
  const undoText = useRef("");
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typing = useRef<Tween | null>(null);
  const reqId = useRef(0);
  const editVer = useRef(0);
  const handed = useRef(false);
  const stateRef = useRef({ rating, selected, len, variant });
  stateRef.current = { rating, selected, len, variant };

  const low = rating > 0 && rating <= 3;
  const visible = useCallback(
    (h: Highlight) => h.polarity === "both" || (low ? h.polarity === "neg" : h.polarity === "pos"),
    [low],
  );

  const sync = useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    if (carbonTextRef.current) carbonTextRef.current.textContent = d.value;
    setCount(t.count(d.value));
    d.style.height = "auto";
    d.style.height = d.scrollHeight + "px";
  }, [t]);

  // mount: motion libs after first paint, initial draft from the stream
  useEffect(() => {
    let alive = true;
    reduceRef.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    sync();
    window.addEventListener("resize", sync);

    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let tick: ((t: number) => void) | null = null;
    loadGsap()
      .then((g) => {
        if (!alive) return;
        gsapRef.current = g;
        if (reduceRef.current) return; // no smooth scrolling for reduced motion
        return import("lenis").then(({ default: Lenis }) => {
          if (!alive) return;
          const l = new Lenis({ lerp: 0.1, smoothWheel: true });
          lenis = l;
          tick = (time: number) => l.raf(time * 1000);
          g.ticker.add(tick);
          g.ticker.lagSmoothing(0);
        });
      })
      .catch(() => {});

    Promise.resolve(p.initialDraft).then(
      (text) => alive && arrive(typeof text === "string" ? text : ""),
      () => alive && arrive(""),
    );

    return () => {
      alive = false;
      window.removeEventListener("resize", sync);
      if (tick) gsapRef.current?.ticker.remove(tick);
      lenis?.destroy();
      typing.current?.kill();
      clearTimeout(undoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function arrive(text: string) {
    // a draft request started by the customer while we waited takes precedence
    if (reqId.current !== 0) return;
    if (!text) {
      void write(false);
      return;
    }
    void typeIn(text, false, ++reqId.current, editVer.current);
  }

  async function fetchDraft() {
    const st = stateRef.current;
    const ids = st.selected
      .filter((id) => {
        const h = p.highlights.find((x) => x.id === id);
        if (!h) return false;
        const lowNow = st.rating > 0 && st.rating <= 3;
        return h.polarity === "both" || (lowNow ? h.polarity === "neg" : h.polarity === "pos");
      })
      .sort();
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: p.token,
        visit: p.visit,
        rating: st.rating,
        highlightIds: ids,
        length: st.len,
        variant: st.variant,
      }),
    });
    if (!res.ok) throw new Error("bad");
    const data = (await res.json()) as { text?: string };
    if (typeof data.text !== "string" || !data.text) throw new Error("bad");
    return data.text;
  }

  async function write(keepUndo: boolean) {
    const my = ++reqId.current;
    const ver = editVer.current;
    setWriting(true);
    setError("");
    let text: string;
    try {
      text = await fetchDraft();
    } catch {
      if (my === reqId.current) {
        setWriting(false);
        setWaiting(false);
        setError(t.draftError);
      }
      return;
    }
    if (my !== reqId.current) return;
    if (ver !== editVer.current) {
      // customer typed while we were fetching: never overwrite
      setWriting(false);
      setSuggest("rewrite");
      return;
    }
    await typeIn(text, keepUndo, my, ver);
  }

  // type only what changed, from the shared beginning (word by word; character by character for ja)
  async function typeIn(text: string, keepUndo: boolean, my: number, ver: number) {
    const g = reduceRef.current ? null : await loadGsap().catch(() => null);
    const d = draftRef.current;
    if (!d || my !== reqId.current) return;
    if (ver !== editVer.current) {
      setWriting(false);
      setSuggest("rewrite");
      return;
    }
    setWaiting(false);
    const from = d.value;
    edited.current = false;
    lastWritten.current = text;
    if (!keepUndo) setSuggest((v) => (v === "undo" ? v : ""));
    typing.current?.kill();
    let k = 0;
    while (k < from.length && k < text.length && from[k] === text[k]) k++;
    let tail: string[];
    if (ja) {
      const code = text.charCodeAt(k - 1);
      if (k > 0 && code >= 0xd800 && code <= 0xdbff) k--; // don't split a surrogate pair
      tail = Array.from(text.slice(k));
    } else {
      k = text.lastIndexOf(" ", k) + 1;
      tail = text.slice(k).split(/(?<=\s)/).filter(Boolean);
    }
    const head = text.slice(0, k);
    if (!g || !tail.length) {
      d.value = text;
      sync();
      setWriting(false);
      return;
    }
    const o = { n: 0 };
    typing.current = g.to(o, {
      n: tail.length,
      duration: Math.min(1.1, 0.15 + tail.length * (ja ? 0.02 : 0.045)),
      ease: "power1.out",
      onUpdate() {
        d.value = head + tail.slice(0, Math.round(o.n)).join("");
        sync();
      },
      onComplete() {
        d.value = text;
        sync();
        setWriting(false);
      },
    });
  }

  // state changes call request() after state settles
  const pending = useRef<null | { explicit: boolean }>(null);
  useEffect(() => {
    const pr = pending.current;
    if (!pr) return;
    pending.current = null;
    request(pr.explicit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating, selected, len, variant]);

  function request(explicit: boolean) {
    if (edited.current && !explicit) {
      setSuggest("rewrite");
      return;
    }
    if (edited.current && explicit) {
      rewrite();
      return;
    }
    void write(false);
  }
  function rewrite() {
    const d = draftRef.current;
    if (!d) return;
    undoText.current = d.value;
    void write(true);
    setSuggest("undo");
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setSuggest((v) => (v === "undo" ? "" : v)), 7000);
  }
  function undo() {
    const d = draftRef.current;
    if (!d) return;
    reqId.current++;
    typing.current?.kill();
    setWriting(false);
    d.value = undoText.current;
    lastWritten.current = "";
    edited.current = true;
    sync();
    setSuggest("");
  }
  function onSuggest() {
    if (suggest === "undo") undo();
    else rewrite();
  }

  function pickRating(i: number) {
    if (i === rating) return;
    const was = tone(rating);
    pending.current = { explicit: false };
    setRating(i);
    if (tone(i) !== was) {
      const lowNow = i > 0 && i <= 3;
      setSelected((cur) =>
        cur.filter((id) => {
          const h = p.highlights.find((x) => x.id === id);
          return h && (h.polarity === "both" || (lowNow ? h.polarity === "neg" : h.polarity === "pos"));
        }),
      );
    }
  }
  function toggleChip(id: string) {
    pending.current = { explicit: false };
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function pickLen(v: "short" | "detailed") {
    if (v === len) return;
    pending.current = { explicit: true };
    setLen(v);
  }
  function newDraft() {
    pending.current = { explicit: true };
    setVariant((v) => v + 1);
  }

  function onInput() {
    const d = draftRef.current;
    if (!d) return;
    editVer.current++;
    edited.current = d.value !== lastWritten.current;
    sync();
    unhand();
  }

  // handover: the carbon copy slides out from under the sheet only after copying
  function hand() {
    const stack = stackRef.current;
    if (!stack) return;
    handed.current = true;
    stack.classList.add(s.handed!);
    const g = reduceRef.current ? null : gsapRef.current;
    if (g) {
      g.to(stack, { paddingBottom: 92, duration: 0.9, ease: "expo.out" });
      if (carbonRef.current) g.fromTo(carbonRef.current, { y: -18 }, { y: 0, duration: 1.2, ease: "expo.out" });
      g.fromTo(stampRef.current, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" });
    } else {
      stack.style.paddingBottom = "92px";
      if (stampRef.current) stampRef.current.style.opacity = "1";
    }
  }
  function unhand() {
    const stack = stackRef.current;
    if (!handed.current || !stack) return;
    handed.current = false;
    stack.classList.remove(s.handed!);
    const g = reduceRef.current ? null : gsapRef.current;
    if (g) {
      g.to(stack, { paddingBottom: 0, duration: 0.6, ease: "expo.out" });
      g.to(stampRef.current, { opacity: 0, duration: 0.2 });
    } else {
      stack.style.paddingBottom = "";
      if (stampRef.current) stampRef.current.style.opacity = "0";
    }
  }

  /** Both fields are optional; only a filled-in email has to be valid. */
  function checkDetails() {
    const e = email.trim();
    const errs = { name: "", email: !e || (EMAIL.test(e) && e.length <= EMAIL_MAX) ? "" : t.emailInvalid };
    setDetailErr(errs);
    if (errs.email) {
      setShowDetails(true);
      emailRef.current?.focus();
    }
    return !errs.email;
  }

  // keepalive lets the save finish even if the customer leaves for the portal; one retry covers a flaky connection.
  async function save(body: string) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(`/api/r/${p.token}/copied`, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body });
        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) return;
      } catch {}
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  async function post(portal: PortalView) {
    const d = draftRef.current;
    if (!d) return;
    if (!checkDetails()) return;
    // Open the portal in the same tap, before any await: iOS Safari blocks window.open once the gesture has passed.
    const copied = navigator.clipboard ? navigator.clipboard.writeText(d.value) : Promise.reject(new Error("no clipboard"));
    window.open(portal.url, "_blank", "noopener");
    let ok = true;
    try {
      await copied;
    } catch {
      ok = false;
    }
    const mail = email.trim().slice(0, EMAIL_MAX);
    setEmailGiven(!!mail);
    void save(JSON.stringify({
        visit: p.visit,
        portalId: portal.id,
        finalText: d.value,
        draftText: lastWritten.current,
        rating,
        edited: d.value !== lastWritten.current,
        name: name.trim().slice(0, NAME_MAX),
        email: mail,
        contactOk: !!mail && contactOk,
      }));
    setChosen(portal);
    setCopyOk(ok);
    if (!ok) {
      d.focus();
      d.select();
    }
    setPostedN((n) => n + 1);
    hand();
  }

  useEffect(() => {
    const g = gsapRef.current;
    if (!postedN || reduceRef.current || !g) return;
    if (afterRef.current) g.from(afterRef.current, { y: 10, opacity: 0, duration: 0.8, ease: "expo.out", delay: 0.25 });
    if (rewardRef.current && p.reward && chosen?.incentive)
      g.from(rewardRef.current, { y: 10, opacity: 0, duration: 0.8, ease: "expo.out", delay: 0.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postedN]);

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!EMAIL.test(addr) || addr.length > EMAIL_MAX) {
      setClaimErr(t.emailInvalid);
      (emailGiven ? emailRef : claimEmailRef).current?.focus();
      return;
    }
    setClaimState("busy");
    setClaimErr("");
    try {
      const res = await fetch(`/api/r/${p.token}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visit: p.visit, email: addr }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        // server messages are English; keep Japanese pages fully Japanese
        setClaimErr(!ja && j.error ? j.error : t.claimError);
        setClaimState("idle");
        return;
      }
      setClaimState("sent");
    } catch {
      setClaimErr(t.claimError);
      setClaimState("idle");
    }
  }

  const primary = p.portals[0];
  const others = p.portals.slice(1);
  const no = sheetNo(p.token);
  const suggestLabel = suggest === "undo" ? t.undo : rating ? t.rewriteFor(rating) : t.rewriteHighlights;
  const showReward = !!p.reward && !!chosen?.incentive;
  const first = p.customerName.trim();
  const thanksName = (() => {
    const n = name.trim() || first;
    return ja ? n : (n.split(/\s+/)[0] ?? "");
  })();

  return (
    <div className={s.page} lang={p.lang}>
      {p.brandName ? (
        <div className={s.brand}>
          <span className={s.mark} aria-hidden="true">{initials(p.brandName)}</span>
          {p.brandName}
        </div>
      ) : null}

      <main>
        <h1 className={s.h1}>{t.heading(first)}</h1>
        <p className={s.lede}>{t.lede(primary ? primary.label : t.reviewSiteFallback)}</p>

        <section className={s.rate} aria-labelledby="rate-l">
          <h2 id="rate-l" className={s.sr}>{t.ratingLabel}</h2>
          <div className={s.rateRow}>
            <div className={s.stars} role="radiogroup" aria-label={t.ratingLabel}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === rating}
                  aria-label={t.starLabel(i)}
                  className={`${s.star} ${i <= rating ? s.on : ""}`}
                  onClick={() => pickRating(i)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} /></svg>
                </button>
              ))}
            </div>
            <span className={s.rateWord} aria-live="polite">{t.ratingWords[rating]}</span>
          </div>
          <div className={s.chips} role="group" aria-label={t.highlightsLabel}>
            {p.highlights.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`${s.chip} ${visible(h) ? "" : s.hidden}`}
                hidden={!visible(h)}
                aria-pressed={visible(h) && selected.includes(h.id)}
                onClick={() => toggleChip(h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </section>

        <section ref={stackRef} className={s.stack} aria-label={t.draftLabel}>
          <div ref={carbonRef} className={s.carbon} aria-hidden="true">
            <div ref={carbonTextRef} className={s.carbonText} />
            <div className={s.carbonTag}>
              <span>{t.carbonCopy(no)}</span>
              <span>{t.carbonTo(chosen?.label ?? primary?.label ?? "")}</span>
            </div>
          </div>
          <div className={`${s.sheet} ${writing ? s.writing : ""}`}>
            <div className={s.sheetHead}>
              <span className={s.sheetNo}>
                <span>{t.sheetNo(no)}</span>
                <span ref={stampRef} className={s.stamp} aria-hidden="true">{t.stampCopied}</span>
              </span>
              <div className={s.seg} role="group" aria-label={t.lengthLabel}>
                <button type="button" aria-pressed={len === "short"} onClick={() => pickLen("short")}>{t.short}</button>
                <button type="button" aria-pressed={len === "detailed"} onClick={() => pickLen("detailed")}>{t.detailed}</button>
              </div>
            </div>
            <label htmlFor="draft" className={s.sr}>{t.editableLabel}</label>
            <div className={s.draftWrap}>
              <textarea
                id="draft"
                ref={draftRef}
                className={s.textarea}
                rows={5}
                spellCheck
                readOnly={waiting}
                aria-busy={writing}
                onInput={onInput}
              />
              {waiting ? (
                <div className={s.skel} aria-hidden="true">
                  <span /><span /><span />
                </div>
              ) : null}
            </div>
            <span className={s.sr} role="status">{waiting ? t.writingStatus : ""}</span>
            <div className={s.sheetFoot}>
              <button type="button" className={s.regen} onClick={newDraft} disabled={writing}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
                {writing ? t.writing : t.newDraft}
              </button>
              <button type="button" className={`${s.suggest} ${suggest ? s.on : ""}`} onClick={onSuggest}>
                {suggestLabel}
              </button>
              <span>{count}</span>
            </div>
            {error ? <p className={s.err} role="alert">{error}</p> : null}
          </div>
        </section>

        {primary ? (
          <section className={s.post} aria-label={t.postLabel}>
            {!showDetails ? (
              <button type="button" className={s.detailsToggle} aria-expanded={false} onClick={() => setShowDetails(true)}>
                {t.detailsToggle}
              </button>
            ) : null}
            <fieldset className={s.details} hidden={!showDetails}>
              <legend className={s.detailsHead}>{t.detailsHeading}</legend>
              <div className={s.fields}>
                <div className={s.field}>
                  <label htmlFor="cust-name">{t.nameLabel}</label>
                  <input
                    id="cust-name"
                    ref={nameRef}
                    type="text"
                    autoComplete="name"
                    maxLength={NAME_MAX}
                    value={name}
                    aria-invalid={detailErr.name ? true : undefined}
                    aria-describedby={detailErr.name ? "cust-name-err" : undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (detailErr.name) setDetailErr((v) => ({ ...v, name: "" }));
                    }}
                  />
                  {detailErr.name ? <p id="cust-name-err" className={s.fieldErr}>{detailErr.name}</p> : null}
                </div>
                <div className={s.field}>
                  <label htmlFor="cust-email">{t.emailLabel}</label>
                  <input
                    id="cust-email"
                    ref={emailRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    maxLength={EMAIL_MAX}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    aria-invalid={detailErr.email ? true : undefined}
                    aria-describedby={detailErr.email ? "cust-email-err" : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (detailErr.email) setDetailErr((v) => ({ ...v, email: "" }));
                      if (claimErr) setClaimErr("");
                    }}
                  />
                  {detailErr.email ? <p id="cust-email-err" className={s.fieldErr}>{detailErr.email}</p> : null}
                </div>
              </div>
              {email.trim() ? (
                <label className={s.optIn}>
                  <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
                  <span>{t.contactOk(p.brandName || t.brandFallback)}</span>
                </label>
              ) : null}
              <p className={s.privacy}>{t.privacy(p.brandName || t.brandFallback)}</p>
            </fieldset>

            <button type="button" className={s.go} onClick={() => post(primary)}>
              <span>{t.copyAndOpen(primary.label)}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </button>
            {others.length ? (
              <div className={s.alts}>
                {t.orPostOn}
                {others.map((o) => (
                  <button key={o.id} type="button" onClick={() => post(o)}>{o.label}</button>
                ))}
              </div>
            ) : null}

            <div className={`${s.fallback} ${chosen && !copyOk ? s.on : ""}`} role="status">
              {t.copyFallback}
            </div>

            <div ref={afterRef} className={`${s.after} ${chosen ? s.on : ""}`} role="status">
              <h2>{copyOk ? t.afterCopied(chosen?.label ?? "") : t.afterNotCopied(chosen?.label ?? "")}</h2>
              <p>{t.afterThanks(thanksName)}</p>
              {chosen?.type === "google" ? (
                <ol className={s.steps}>
                  {t.googleSteps(rating).map((step) => <li key={step}>{step}</li>)}
                </ol>
              ) : null}
              <div className={s.row}>
                <button type="button" className={s.btnLine} onClick={() => chosen && window.open(chosen.url, "_blank", "noopener")}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>{t.openAgain}
                </button>
                <button
                  type="button"
                  className={s.btnLine}
                  onClick={() => navigator.clipboard?.writeText(draftRef.current?.value ?? "").catch(() => {})}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></svg>{t.copyAgain}
                </button>
              </div>
            </div>

            {p.reward ? (
              <div ref={rewardRef} className={`${s.reward} ${showReward ? s.on : ""}`}>
                <h3>{p.reward.title}</h3>
                <p>{p.reward.description}</p>
                {claimState === "sent" ? (
                  <div className={s.sent} role="status">{t.claimSent}</div>
                ) : (
                  <form onSubmit={submitClaim} noValidate>
                    {emailGiven ? (
                      <p className={s.claimTo}>{t.claimTo(email.trim())}</p>
                    ) : (
                      <input
                        ref={claimEmailRef}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        spellCheck={false}
                        maxLength={EMAIL_MAX}
                        aria-label={t.claimEmailLabel}
                        placeholder={t.emailPlaceholder}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (claimErr) setClaimErr("");
                        }}
                      />
                    )}
                    <button className={s.send} type="submit" disabled={claimState === "busy"}>{t.claimSend}</button>
                  </form>
                )}
                {claimErr ? <p className={s.formErr} role="alert">{claimErr}</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className={s.foot}>
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}
