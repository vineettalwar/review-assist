import { cn } from "./cn";

export function Segmented<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded border border-ink">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 px-3 text-[13px] font-medium transition-colors duration-150 not-first:border-l not-first:border-ink",
            o.value === value ? "bg-ink text-white" : "bg-white text-ink hover:bg-surface",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
