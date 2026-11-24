import { test } from "node:test";
import assert from "node:assert/strict";
import { importCsv, parseCsv, toCsv } from "../lib/csv.ts";
import { lineSchema, type Line } from "../lib/schemas.ts";

const line = (over: Partial<Line> = {}): Line =>
  lineSchema.parse({ id: "l1", partName: "Bracket", process: "cnc", material: "al-6061", lengthMm: 100, widthMm: 50, heightMm: 20, quantity: 10, finish: "none", tolerance: "standard", holes: 4, bends: 0, ...over });

test("CSV parser handles quotes, commas, CRLF and BOM", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n'), [["a", "b"], ["x, y", 'say "hi"']]);
});

test("CSV round trip and row-numbered errors", () => {
  const csv = toCsv([line({ partName: 'Plate, "big"' })]);
  let n = 0;
  const back = importCsv(csv, () => `id${n++}`);
  assert.equal(back.errors.length, 0);
  assert.equal(back.lines[0].partName, 'Plate, "big"');
  const bad = importCsv("part_name,process,material,length_mm,width_mm,height_mm,quantity\nA,cnc,unobtanium,1,1,1,1\nB,cnc,al-6061,1,1,1,0\nC,sheet,al-5052,100,50,2,5\n", () => "x");
  assert.deepEqual(bad.errors.map((e) => e.row), [2, 3]);
  assert.equal(bad.lines.length, 1);
  assert.match(importCsv("foo\n1", () => "x").errors[0].message, /Missing columns/);
});

test("CSV export neutralises formula injection", () => {
  const csv = toCsv([line({ partName: "=HYPERLINK(\"http://x\")" })]);
  assert.match(csv, /'=HYPERLINK/);
});
