"use client";

import { useFormStatus } from "react-dom";
import { Button, Input, Icons } from "@/components/ui";
import { createProductFromUrl } from "./scan-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="line" disabled={pending}>
      <Icons.Plus size={16} aria-hidden /> {pending ? "Scanning the page…" : "Scan and create"}
    </Button>
  );
}

/** URL box that scans a product page and creates the product from it. */
export function FromUrlForm({ back, compact = false }: { back: "list" | "new"; compact?: boolean }) {
  const id = `from-url-${back}`;
  return (
    <form action={createProductFromUrl} className={compact ? "flex flex-wrap items-end gap-2" : "grid gap-3"}>
      <input type="hidden" name="back" value={back} />
      <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">Add from a product page</label>
        <Input id={id} name="url" type="url" required placeholder="https://yourshop.com/products/example" />
        {!compact && <span className="text-xs text-ink-3">We read the page and fill in the name, facts and highlights. Review them afterwards.</span>}
      </div>
      <Submit />
    </form>
  );
}
