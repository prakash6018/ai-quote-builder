// CSV import/export of quote lines. RFC 4180 quoting, header-based columns,
// row-numbered errors so an estimator can fix the spreadsheet and retry.
import { lineSchema, type Line } from "./schemas.ts";

export const CSV_COLUMNS = [
  "part_name", "process", "material", "length_mm", "width_mm", "height_mm",
  "quantity", "finish", "tolerance", "holes", "bends",
] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const esc = (v: string | number) => {
  const s = String(v);
  // Neutralise spreadsheet formula injection, then quote if needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(lines: Line[], prices?: Map<string, { unitPriceCents: number; totalCents: number }>): string {
  const head = [...CSV_COLUMNS, ...(prices ? ["unit_price", "line_total"] : [])];
  const body = lines.map((l) => {
    const p = prices?.get(l.id);
    return [
      l.partName, l.process, l.material, l.lengthMm, l.widthMm, l.heightMm,
      l.quantity, l.finish, l.tolerance, l.holes, l.bends,
      ...(p ? [(p.unitPriceCents / 100).toFixed(2), (p.totalCents / 100).toFixed(2)] : []),
    ].map(esc).join(",");
  });
  return [head.join(","), ...body].join("\r\n") + "\r\n";
}

export interface ImportResult {
  lines: Line[];
  errors: { row: number; message: string }[];
}

export function importCsv(text: string, makeId: () => string): ImportResult {
  const rows = parseCsv(text);
  if (!rows.length) return { lines: [], errors: [{ row: 1, message: "The file is empty." }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c) && !["holes", "bends", "finish", "tolerance"].includes(c));
  if (missing.length) return { lines: [], errors: [{ row: 1, message: `Missing columns: ${missing.join(", ")}` }] };
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const num = (v: string) => (v === "" ? NaN : Number(v.replace(/,/g, "")));
  const lines: Line[] = [];
  const errors: ImportResult["errors"] = [];
  rows.slice(1).forEach((r, i) => {
    const parsed = lineSchema.safeParse({
      id: makeId(),
      partName: col(r, "part_name"),
      drawing: null,
      process: col(r, "process").toLowerCase(),
      material: col(r, "material").toLowerCase(),
      lengthMm: num(col(r, "length_mm")),
      widthMm: num(col(r, "width_mm")),
      heightMm: num(col(r, "height_mm")),
      quantity: num(col(r, "quantity")),
      finish: (col(r, "finish") || "none").toLowerCase(),
      tolerance: (col(r, "tolerance") || "standard").toLowerCase(),
      holes: col(r, "holes") === "" ? 0 : num(col(r, "holes")),
      bends: col(r, "bends") === "" ? 0 : num(col(r, "bends")),
      confidence: {},
      reviewed: true,
    });
    if (parsed.success) lines.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[0] ?? "row").replace(/Mm$/, "_mm").replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
      const message =
        issue.code === "invalid_enum_value"
          ? `${field} "${issue.received}" isn't recognised (use ${issue.options.join(", ")})`
          : `${field}: ${issue.message}`;
      errors.push({ row: i + 2, message });
    }
  });
  return { lines, errors };
}
