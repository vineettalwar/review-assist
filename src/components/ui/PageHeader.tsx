import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] [text-wrap:balance]">{title}</h1>
        {description && <p className="mt-1 max-w-[60ch] text-sm text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}
