import type { ReactNode } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-surface text-ink-2",
  blue: "bg-wash text-carbon",
  green: "bg-ok-wash text-ok",
  amber: "bg-warn-wash text-warn",
} as const;

export function Pill({ tone = "neutral", dot = false, className, children }: { tone?: keyof typeof tones; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-[3px] text-xs font-medium", tones[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
