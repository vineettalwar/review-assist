import type { ReactNode } from "react";
import { cn } from "./cn";

export function Field({
  label, hint, error, htmlFor, className, children,
}: { label: ReactNode; hint?: ReactNode; error?: ReactNode; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">{label}</label>
      {children}
      {hint && !error && <span className="text-xs text-ink-3">{hint}</span>}
      {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}
