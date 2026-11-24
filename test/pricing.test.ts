import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMargin, priceLine, priceQuote, unitCost } from "../lib/pricing.ts";
import { lineSchema, type Line } from "../lib/schemas.ts";

const line = (over: Partial<Line> = {}): Line =>
  lineSchema.parse({ id: "l1", partName: "Bracket", process: "cnc", material: "al-6061", lengthMm: 100, widthMm: 50, heightMm: 20, quantity: 10, finish: "none", tolerance: "standard", holes: 4, bends: 0, ...over });

test("price = cost / (1 - margin), rounded up to the cent", () => {
  assert.equal(applyMargin(7000, 0.3), 10000);
  assert.equal(applyMargin(1001, 0.3), 1430);
});

test("setup is amortised: bigger batches cost less per part", () => {
  const one = unitCost(line({ quantity: 1 }));
  const hundred = unitCost(line({ quantity: 100 }));
  assert.ok(hundred.costCents < one.costCents);
  assert.equal(one.setupPerUnitCents, 12000);
  assert.equal(hundred.setupPerUnitCents, 120);
});

test("harder materials and tighter tolerances take longer", () => {
  assert.ok(unitCost(line({ material: "ss-304" })).machiningCents > unitCost(line()).machiningCents);
  assert.ok(unitCost(line({ tolerance: "tight" })).machiningCents > unitCost(line({ tolerance: "precision" })).machiningCents);
});

test("finish has a minimum charge", () => {
  assert.equal(unitCost(line({ finish: "anodize", lengthMm: 10, widthMm: 10, heightMm: 5 })).finishCents, 400);
});

test("tiers raise price and shorten lead time", () => {
  const std = priceLine(line(), "standard", "USD", 1);
  const pri = priceLine(line(), "priority", "USD", 1);
  assert.ok(pri.unitPriceCents > std.unitPriceCents);
  assert.ok(pri.leadDays < std.leadDays);
  assert.deepEqual(std.breaks.map((b) => b.qty), [1, 10, 50, 100]);
  assert.ok(std.breaks[3].unitPriceCents < std.breaks[0].unitPriceCents);
});

test("quote totals are exact sums in integer cents, converted once", () => {
  const q = priceQuote([line(), line({ id: "l2", quantity: 3 })], "standard", 30, "INR", 84);
  assert.equal(q.subtotalCents, q.lines.reduce((s, l) => s + l.totalCents, 0));
  assert.ok(q.lines.every((l) => Number.isInteger(l.unitPriceCents) && l.totalCents === l.unitPriceCents * (l.lineId === "l1" ? 10 : 3)));
  assert.equal(q.depositCents, Math.round(q.subtotalCents * 0.3));
  const usd = priceQuote([line()], "standard", 30, "USD", 1);
  assert.equal(priceQuote([line()], "standard", 30, "INR", 84).lines[0].unitPriceCents, Math.round(usd.lines[0].unitPriceCents * 84));
});
