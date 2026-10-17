import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Note({ icon, className, children }: { icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("mb-5 flex items-start gap-2.5 rounded border border-carbon bg-wash px-4 py-3.5 text-[13px] text-ink-2 [&_b]:text-ink", className)}>
      <span className="mt-0.5 flex-none text-carbon">{icon ?? <Info size={16} aria-hidden />}</span>
      <span>{children}</span>
    </div>
  );
}
