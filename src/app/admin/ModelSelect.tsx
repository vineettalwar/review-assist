"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import type { ModelOption } from "@/lib/ai";

const OTHER = "__other__";

function price(m: ModelOption) {
  if (m.inPerM == null || m.outPerM == null) return "";
  if (m.inPerM === 0 && m.outPerM === 0) return " · free";
  const f = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(n < 10 ? 2 : 0));
  return ` · $${f(m.inPerM)} / $${f(m.outPerM)} per M`;
}

/**
 * Dropdown of every model a provider offers, grouped (Suggested first, then by maker), with prices where known.
 * "Other model id…" switches to a text field for ids the list doesn't have yet.
 * Controlled with value/onChange (Training), or a plain form field with name/defaultValue (Settings).
 */
export function ModelSelect({
  id, options, value, defaultValue, onChange, name,
}: {
  id: string;
  options: ModelOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (model: string) => void;
  name?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const known = options.some((o) => o.id === current);
  const [typing, setTyping] = useState(!!current && !known);
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const groups = new Map<string, ModelOption[]>();
  for (const o of options) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);

  return (
    <div className="grid gap-1.5">
      <Select
        id={id}
        value={typing ? OTHER : current}
        onChange={(e) => {
          if (e.target.value === OTHER) return setTyping(true);
          setTyping(false);
          set(e.target.value);
        }}
        className="font-mono text-[13px]"
      >
        {!current && <option value="">Pick a model</option>}
        {[...groups].map(([g, list]) => (
          <optgroup key={g} label={g}>
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id}{o.name !== o.id ? ` (${o.name})` : ""}{price(o)}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Other model id…</option>
      </Select>
      {typing && (
        <Input
          aria-label="Model id"
          value={current}
          onChange={(e) => set(e.target.value.trim())}
          placeholder="e.g. vendor/model-name"
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-[13px]"
        />
      )}
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
