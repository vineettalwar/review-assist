"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { saveReward, type RewardFormState } from "./actions";

const VALUE_LABELS = {
  code: { label: "Promo code", hint: "Shown to the customer after they post.", placeholder: "THANKS15" },
  link: { label: "Reward link", hint: "Opens when the customer claims. Must start with https://", placeholder: "https://" },
  manual: { label: "Note to yourself", hint: "Not shown to the customer. You send the reward yourself.", placeholder: "e.g. Email a coupon within 2 days" },
} as const;

export function RewardForm({ initial }: { initial: { title: string; description: string; kind: "code" | "link" | "manual"; value: string } }) {
  const [kind, setKind] = useState(initial.kind);
  const [state, action, pending] = useActionState<RewardFormState, FormData>(saveReward, null);
  const v = VALUE_LABELS[kind];
  return (
    <form action={action} className="mb-4 rounded border border-rule bg-white p-[22px]">
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="title"><Input id="title" name="title" required maxLength={120} defaultValue={initial.title} /></Field>
        <Field label="Type" htmlFor="kind">
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="code">Promo code</option>
            <option value="link">Link</option>
            <option value="manual">I&apos;ll send it myself</option>
          </Select>
        </Field>
        <Field label={v.label} hint={v.hint} htmlFor="value">
          <Input id="value" name="value" maxLength={500} placeholder={v.placeholder} defaultValue={initial.value} />
        </Field>
        <Field label="Description" htmlFor="description" hint="One line under the title">
          <Textarea id="description" name="description" rows={2} maxLength={500} defaultValue={initial.description} />
        </Field>
      </div>
      {state?.error && <p role="alert" className="mb-3 text-sm font-medium text-danger">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save reward"}</Button>
        {state?.saved && <span role="status" className="text-sm text-ok">Saved</span>}
      </div>
    </form>
  );
}
