"use client";

import { useOptimistic, useTransition } from "react";
import { Toggle } from "./Toggle";

/** Toggle that calls a server action with the next value, updating optimistically. */
export function ActionToggle({
  on, locked, label, action,
}: { on: boolean; locked?: boolean; label: string; action: (next: boolean) => Promise<void> }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(on);
  return (
    <span className={pending ? "opacity-70" : undefined}>
      <Toggle
        on={value}
        locked={locked}
        label={label}
        onChange={(next) => start(async () => { setValue(next); await action(next); })}
      />
    </span>
  );
}
