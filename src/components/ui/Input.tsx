import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const controlClass =
  "w-full rounded border border-rule bg-white px-3 text-ink caret-carbon outline-none transition-[border-color,box-shadow] hover:border-rule-strong focus:border-ink focus:shadow-[0_0_0_3px_var(--color-wash)] disabled:bg-surface disabled:text-ink-3 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, "h-[42px]", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(controlClass, "resize-y py-2.5 leading-[1.55]", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "h-[42px]", className)} {...props}>
      {children}
    </select>
  );
}

/** Large, underline-only controls for one-question-at-a-time forms. */
export const bigControlClass =
  "w-full border-0 border-b-2 border-rule bg-transparent px-0 pb-2 pt-1 text-[20px] leading-snug text-ink caret-carbon outline-none transition-colors placeholder:text-ink-3/60 hover:border-rule-strong focus:border-carbon focus-visible:outline-none";

export function BigInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(bigControlClass, className)} {...props} />;
}

export function BigTextarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(bigControlClass, "max-h-[45vh] min-h-[3lh] resize-none [field-sizing:content]", className)} {...props} />;
}

/** Radio options as large tappable rows. Arrow keys move between them natively. */
export function Choices({ name, options, defaultValue, label }: { name: string; options: readonly { value: string; label: string }[]; defaultValue: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid max-w-[360px] gap-2">
      {options.map((o, i) => (
        <label key={o.value} className="flex h-12 cursor-pointer items-center gap-3 rounded border border-rule px-3 text-[16px] transition-colors hover:border-rule-strong has-[:checked]:border-carbon has-[:checked]:bg-wash has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-carbon">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
          <span aria-hidden className="grid size-6 place-items-center rounded-sm border border-rule bg-white text-[12px] font-semibold text-ink-2 peer-checked:border-carbon peer-checked:bg-carbon peer-checked:text-white">{String.fromCharCode(65 + i)}</span>
          {o.label}
        </label>
      ))}
    </div>
  );
}
