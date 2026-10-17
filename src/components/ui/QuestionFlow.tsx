"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { ArrowRight, Check, ChevronDown, ChevronUp } from "./icons";
import { cn } from "./cn";

export type Question = {
  title: string;
  hint?: ReactNode;
  /** id of the main control, so the question labels it. */
  htmlFor?: string;
  required?: boolean;
  /** Multi-line answer: Enter adds a line, Cmd/Ctrl+Enter moves on. */
  long?: boolean;
  body: ReactNode;
};

const TEXT = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select";

/** A panel counts as answered when any of its controls holds a value. */
function answered(panel: HTMLElement) {
  for (const el of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT)) if (el.value.trim()) return true;
  if (panel.querySelector("input:checked")) return true;
  for (const el of panel.querySelectorAll<HTMLInputElement>("input[type=hidden]")) if (el.value && el.value !== "[]") return true;
  for (const el of panel.querySelectorAll<HTMLInputElement>("input[type=file]")) if (el.files?.length) return true;
  return Boolean(panel.querySelector("[data-answered]"));
}

/**
 * Asks one question at a time inside a regular form. Every control stays mounted (hidden ones still submit),
 * so the server action is unchanged. Enter moves on from a one-line answer, Cmd/Ctrl+Enter from a long one.
 */
export function QuestionFlow({ questions, submitLabel }: { questions: Question[]; submitLabel: string }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => questions.map(() => false));
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const moved = useRef(false);
  const last = questions.length - 1;

  const refresh = useCallback(() => {
    // After React applies the change (chips, toggles), read what the panels now hold.
    setTimeout(() => setDone(panels.current.map((p) => (p ? answered(p) : false))), 0);
  }, []);
  useEffect(refresh, [refresh]);

  const go = useCallback((i: number) => {
    moved.current = true;
    setStep(Math.max(0, Math.min(last, i)));
  }, [last]);

  useEffect(() => {
    if (!moved.current) return;
    const p = panels.current[step];
    const el = p?.querySelector<HTMLElement>(`${TEXT}, input:checked, input[type=radio], input[type=checkbox], button, input[type=file]`);
    el?.focus({ preventScroll: true });
    p?.closest("section")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step]);

  const next = () => {
    const p = panels.current[step];
    const bad = p?.querySelector<HTMLInputElement>(":invalid");
    if (bad) return bad.reportValidity();
    go(step + 1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    const isArea = t.tagName === "TEXTAREA";
    const isLine = t.tagName === "INPUT" && !["checkbox", "radio", "file", "submit", "button"].includes((t as HTMLInputElement).type);
    if (e.key === "Enter" && step < last && (isLine || (isArea && (e.metaKey || e.ctrlKey)) || (t.tagName === "INPUT" && !isLine))) {
      e.preventDefault();
      next();
      return;
    }
    // Letter keys pick an option, as long as the person isn't typing.
    if (!isArea && !isLine && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const radios = panels.current[step]?.querySelectorAll<HTMLInputElement>("input[type=radio]");
      const r = radios?.[e.key.toUpperCase().charCodeAt(0) - 65];
      if (r) {
        e.preventDefault();
        r.click();
        r.focus();
        refresh();
      }
    }
  };

  // A required field on a hidden question can't show its own message, so open that question first.
  const onInvalid = (e: React.FormEvent) => {
    const i = panels.current.findIndex((p) => p?.contains(e.target as Node));
    if (i >= 0 && i !== step) {
      go(i);
      setTimeout(() => (e.target as HTMLInputElement).reportValidity(), 50);
    }
  };

  const q = questions[step];
  const pct = ((step + 1) / questions.length) * 100;

  return (
    <section className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]" onKeyDown={onKeyDown} onInput={refresh} onChange={refresh} onClick={refresh} onInvalidCapture={onInvalid}>
      <nav aria-label="Questions" className="hidden lg:block">
        <ol className="grid gap-0.5">
          {questions.map((x, i) => (
            <li key={x.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-surface",
                  i === step ? "bg-surface font-medium text-ink" : "text-ink-3",
                )}
              >
                <span className={cn("grid size-[18px] flex-none place-items-center rounded-full text-[10px] tabular-nums", done[i] ? "bg-carbon text-white" : "border border-rule")}>
                  {done[i] ? <Check size={11} strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className="truncate">{x.title.replace(/\?$/, "")}</span>
                <span className="sr-only">{done[i] ? "answered" : "empty"}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="relative flex min-h-[400px] flex-col overflow-hidden rounded border border-rule bg-white">
        <div className="h-[3px] bg-surface" aria-hidden>
          <div className="h-full bg-carbon transition-[width] duration-500 ease-[var(--ease-out-expo)]" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex-1 px-6 pb-6 pt-10 sm:px-12 sm:pt-14">
          {questions.map((x, i) => (
            <div
              key={x.title}
              ref={(el) => { panels.current[i] = el; }}
              hidden={i !== step}
              role="group"
              aria-labelledby={`q-${i}`}
              className={i === step ? "q-in" : undefined}
            >
              <p className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-carbon">
                {i + 1} <ArrowRight size={13} aria-hidden />
              </p>
              {x.htmlFor ? (
                <label id={`q-${i}`} htmlFor={x.htmlFor} className="mt-2 block text-[24px] font-semibold leading-tight tracking-[-0.02em] text-balance">
                  {x.title}{x.required && <span className="text-carbon"> *</span>}
                </label>
              ) : (
                <p id={`q-${i}`} className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-balance">{x.title}</p>
              )}
              {x.hint && <p className="mt-1.5 text-[15px] text-ink-3">{x.hint}</p>}
              <div className="mt-8">{x.body}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-rule px-6 py-4 sm:px-12">
          {step < last ? (
            <>
              <Button type="button" onClick={next}>OK <Check size={15} aria-hidden /></Button>
              <span className="hidden text-[12px] text-ink-3 sm:inline">
                press <kbd className="font-sans font-medium text-ink-2">{q.long ? "⌘ Enter ↵" : "Enter ↵"}</kbd>
              </span>
            </>
          ) : (
            <Button type="submit">{submitLabel}</Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            {step < last && <Button type="submit" variant="ghost" size="sm" className="mr-2">Save</Button>}
            <Button type="button" variant="ghost" size="sm" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous question"><ChevronUp size={16} aria-hidden /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => go(step + 1)} disabled={step === last} aria-label="Next question"><ChevronDown size={16} aria-hidden /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
