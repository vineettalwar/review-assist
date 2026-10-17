import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded border border-rule bg-white", className)} {...props} />;
}

/** Padded card section with optional heading, as used on Brand / Settings. */
export function Section({ title, description, className, children }: { title?: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("mb-4 p-[22px]", className)}>
      {title && <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
      {description && <p className="mb-4 text-[13px] text-ink-3">{description}</p>}
      {children}
    </Card>
  );
}
