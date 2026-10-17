import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export function Chip({ on = false, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-150",
        on ? "border-ink bg-ink text-white" : "border-rule bg-white text-ink hover:border-rule-strong",
        className,
      )}
      {...props}
    />
  );
}
