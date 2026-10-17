"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui";

export function ActiveToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name="active" value={on ? "1" : "0"} />
      <Toggle on={on} onChange={setOn} label="Active" />
      <span className="text-sm text-ink-2">{on ? "Active: new links can use this product." : "Inactive"}</span>
    </div>
  );
}
