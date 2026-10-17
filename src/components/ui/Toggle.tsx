import { Lock } from "lucide-react";
import { cn } from "./cn";

/** Switch. `locked` renders the disabled, lock-marked state used for incentive-locked portals. */
export function Toggle({
  on, locked = false, onChange, label, name,
}: { on: boolean; locked?: boolean; onChange?: (next: boolean) => void; label: string; name?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on && !locked}
      aria-label={label}
      aria-disabled={locked || undefined}
      disabled={locked}
      name={name}
      onClick={() => onChange?.(!on)}
      className={cn(
        "relative h-[22px] w-[38px] flex-none rounded-full transition-colors duration-150",
        on && !locked ? "bg-carbon" : "bg-[#cfd5e0]",
        locked && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] grid size-4 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(16,21,34,0.2)] transition-[left] duration-200 ease-out-expo",
          on && !locked && "left-[19px]",
        )}
      >
        {locked && <Lock size={9} className="text-ink-3" aria-hidden />}
      </span>
    </button>
  );
}
