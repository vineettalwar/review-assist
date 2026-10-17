/** Minimal CSV parser: quoted fields, escaped quotes (""), newlines inside quotes. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const text = input.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function csvToProducts(input: string) {
  const rows = parseCsv(input);
  if (rows.length && rows[0][0]?.trim().toLowerCase() === "name") rows.shift();
  return rows
    .map((r) => ({ name: (r[0] ?? "").trim(), category: (r[1] ?? "").trim(), knowledge: (r[2] ?? "").trim() }))
    .filter((p) => p.name);
}
