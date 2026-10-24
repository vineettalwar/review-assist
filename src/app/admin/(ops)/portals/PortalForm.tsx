"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Icons, Input, Select, buttonClass } from "@/components/ui";
import { savePortal, type PortalFormState } from "./actions";

const LOCKED = ["google", "trustpilot", "amazon", "yelp", "facebook"];
const PRESETS: { type: string; label: string; name: string }[] = [
  { type: "google", label: "Google", name: "Google" },
  { type: "trustpilot", label: "Trustpilot", name: "Trustpilot" },
  { type: "amazon", label: "Amazon", name: "Amazon" },
  { type: "yelp", label: "Yelp", name: "Yelp" },
  { type: "facebook", label: "Facebook", name: "Facebook" },
  { type: "g2", label: "G2", name: "G2" },
  { type: "custom", label: "", name: "Custom (your website, etc.)" },
];

export type PortalInitial = { id: string; type: string; label: string; url: string; allowsIncentives: boolean; minChars: number };

export function PortalForm({ initial }: { initial?: PortalInitial }) {
  const router = useRouter();
  const [type, setType] = useState(initial?.type ?? "google");
  const [label, setLabel] = useState(initial?.label ?? "Google");
  const locked = LOCKED.includes(type);
  const [state, action, pending] = useActionState<PortalFormState, FormData>(async (prev, fd) => {
    const res = await savePortal(prev, fd);
    if (res?.ok) router.push("/admin/portals");
    return res;
  }, null);

  function onType(next: string) {
    const prevPreset = PRESETS.find((p) => p.type === type);
    // only overwrite the label if it is empty or still the previous preset's default
    if (!label.trim() || label === prevPreset?.label) setLabel(PRESETS.find((p) => p.type === next)?.label ?? "");
    setType(next);
  }

  return (
    <form action={action} className="mb-6 rounded border border-ink bg-white p-[22px]">
      <div className="mb-4 text-[11px] tracking-[0.08em] text-ink-3">{initial ? "EDIT PORTAL" : "NEW PORTAL"}</div>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(e) => onType(e.target.value)}>
            {PRESETS.map((p) => <option key={p.type} value={p.type}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Label" htmlFor="label">
          <Input id="label" name="label" required maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      {type === "google" ? (
        <Field
          label="Place ID or Google review link"
          htmlFor="url"
          hint="Opens Google's “Write a review” box. Use the link from Google Business Profile → Ask for reviews, or your Place ID."
          className="mb-2"
        >
          <Input id="url" name="url" type="text" required placeholder="ChIJ… or https://g.page/r/…/review" defaultValue={initial?.url ?? ""} />
        </Field>
      ) : (
        <Field label="Review URL" htmlFor="url" hint="Where the customer lands to post. Must start with https://" className="mb-4">
          <Input id="url" name="url" type="url" required placeholder="https://" defaultValue={initial?.url ?? ""} />
        </Field>
      )}
      {type === "google" && (
        <p className="mb-4 text-xs text-ink-3">
          Don&apos;t know your Place ID?{" "}
          <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="underline">
            Find it with Google&apos;s Place ID Finder
          </a>
          .
        </p>
      )}
      <Field label="Minimum review length" htmlFor="minChars" hint="Characters the site requires, e.g. 50 for Bazaarvoice. 0 = no minimum." className="mb-4 max-w-[220px]">
        <Input id="minChars" name="minChars" type="number" min={0} max={2000} defaultValue={initial?.minChars ?? 0} />
      </Field>
      <label className="mb-5 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox" name="allowsIncentives" disabled={locked}
          defaultChecked={!locked && initial?.allowsIncentives}
          key={locked ? "locked" : "open"}
          className="size-4 accent-carbon disabled:opacity-50"
        />
        <span className={locked ? "text-ink-3" : ""}>Offer the reward for posting here</span>
        {locked && <span className="flex items-center gap-1 text-xs text-ink-3"><Icons.Lock size={13} aria-hidden />Not allowed on this portal</span>}
      </label>
      {state?.error && <p role="alert" className="mb-3 text-sm font-medium text-danger">{state.error}</p>}
      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save portal" : "Add portal"}</Button>
        <a href="/admin/portals" className={buttonClass("line")}>Cancel</a>
      </div>
    </form>
  );
}
