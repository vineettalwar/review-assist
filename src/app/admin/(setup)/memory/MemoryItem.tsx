import { Button, Icons, Input, Pill, Select, Textarea, cn } from "@/components/ui";
import type { Memory } from "@/db";
import { addMemory, approveMemory, archiveMemory, updateMemory } from "./actions";

const TONE = { fact: "neutral", style: "blue", avoid: "amber" } as const;
const LABEL = { fact: "Fact", style: "Style", avoid: "Avoid" } as const;

export function KindPill({ kind }: { kind: Memory["kind"] }) {
  return <Pill tone={TONE[kind]}>{LABEL[kind]}</Pill>;
}

export function KindSelect({ defaultValue = "fact", id }: { defaultValue?: string; id?: string }) {
  return (
    <Select id={id} name="kind" defaultValue={defaultValue} aria-label="Kind" className="w-auto min-w-[110px]">
      <option value="fact">Fact</option>
      <option value="style">Style</option>
      <option value="avoid">Avoid</option>
    </Select>
  );
}

/** One memory row. Proposed items get a dashed carbon-slip border and Approve / Edit / Dismiss. */
export function MemoryItem({ m, scope, returnTo }: { m: Memory; scope: string; returnTo: string }) {
  const proposed = m.status === "proposed";
  const hidden = <input type="hidden" name="returnTo" value={returnTo} />;
  return (
    <li className={cn("rounded px-3.5 py-3", proposed ? "border border-dashed border-carbon bg-white" : "border border-rule")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">{m.text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <KindPill kind={m.kind} />
            <span>{scope}</span>
            <span aria-hidden>·</span>
            <span>Source: {m.source}</span>
          </div>
          {proposed && m.evidence && <p className="mt-1.5 text-xs text-ink-3">Evidence: {m.evidence}</p>}
        </div>
        <div className="flex flex-none items-center gap-1">
          {proposed && (
            <form action={approveMemory.bind(null, m.id)}>
              {hidden}
              <Button type="submit" size="sm"><Icons.Check size={14} aria-hidden /> Approve</Button>
            </form>
          )}
          <form action={archiveMemory.bind(null, m.id)}>
            {hidden}
            <Button type="submit" variant="ghost" size="sm">{proposed ? "Dismiss" : "Archive"}</Button>
          </form>
        </div>
      </div>
      <details className="mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-carbon [&::-webkit-details-marker]:hidden">
          <Icons.Pencil size={12} aria-hidden /> Edit
        </summary>
        <form action={updateMemory.bind(null, m.id)} className="mt-2 grid gap-2">
          {hidden}
          <Textarea name="text" rows={2} defaultValue={m.text} maxLength={200} required aria-label="Memory text" />
          <div className="flex flex-wrap items-center gap-2">
            <KindSelect defaultValue={m.kind} />
            <Button type="submit" variant="line" size="sm">{proposed ? "Save edit" : "Save"}</Button>
          </div>
        </form>
      </details>
    </li>
  );
}

export function AddMemoryForm({ productId, returnTo }: { productId: string | null; returnTo: string }) {
  return (
    <form action={addMemory} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="productId" value={productId ?? ""} />
      <KindSelect />
      <Input name="text" required maxLength={200} placeholder="One short sentence" aria-label="New memory" className="min-w-[220px] flex-1" />
      <Button type="submit" variant="line"><Icons.Plus size={16} aria-hidden /> Add</Button>
    </form>
  );
}
