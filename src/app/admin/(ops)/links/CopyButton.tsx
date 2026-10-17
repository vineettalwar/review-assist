"use client";

import { useState } from "react";
import { Button, Icons } from "@/components/ui";

export function CopyButton({ text, label = "Copy", variant = "line", size = "sm" }: { text: string; label?: string; variant?: "line" | "ghost"; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <Button variant={variant} size={size} onClick={copy}>
      {done ? <Icons.Check size={14} aria-hidden /> : null}
      {done ? "Copied" : label}
    </Button>
  );
}
