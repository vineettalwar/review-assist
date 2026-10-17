import Link from "next/link";
import { Section } from "@/components/ui";
import { listMemories } from "@/lib/memory";
import type { Memory } from "@/db";
import { AddMemoryForm, KindPill } from "./MemoryItem";

/** Compact memory panel for the brand page (productId null) or a product page. Must sit outside any other <form>. */
export async function MemoryPanel({ brandId, productId, returnTo, title }: { brandId: string; productId: string | null; returnTo: string; title: string }) {
  let items: Memory[] = [];
  let failed = false;
  try {
    items = await listMemories(brandId, { productId, status: "all" });
  } catch {
    failed = true;
  }
  const active = items.filter((m) => m.status === "active");
  const proposed = items.filter((m) => m.status === "proposed");
  const anchor = productId ? `/admin/memory#product-${productId}` : "/admin/memory#brand";
  return (
    <Section title={title}>
      {failed ? (
        <p className="text-sm text-ink-2">Memory isn&apos;t available right now.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span>{active.length} active</span>
            <Link href="/admin/memory#waiting" className={proposed.length ? "font-medium text-carbon underline underline-offset-2" : ""}>
              {proposed.length} waiting for review
            </Link>
            <Link href={anchor} className="underline underline-offset-2">Manage</Link>
          </div>
          {active.length > 0 && (
            <ul className="mt-3 grid gap-1.5">
              {active.slice(0, 4).map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm"><KindPill kind={m.kind} /> <span>{m.text}</span></li>
              ))}
              {active.length > 4 && <li className="text-xs text-ink-3">and {active.length - 4} more</li>}
            </ul>
          )}
          <AddMemoryForm productId={productId} returnTo={returnTo} />
        </>
      )}
    </Section>
  );
}
