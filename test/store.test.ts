import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lineSchema, type Line } from "../lib/schemas.ts";

const line = (over: Partial<Line> = {}): Line =>
  lineSchema.parse({ id: "l1", partName: "Bracket", process: "cnc", material: "al-6061", lengthMm: 100, widthMm: 50, heightMm: 20, quantity: 10, finish: "none", tolerance: "standard", holes: 4, bends: 0, ...over });

test("store: versions, conflict check, idempotent payments, amount check", async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "qb-"));
  const store = await import("../lib/store.ts");
  const q = await store.createQuote({ customer: { name: "A", email: "a@x.io" }, currency: "USD", fxRate: 1, first: { tier: "standard", depositPct: 30, lines: [line()], subtotalCents: 10000, depositCents: 3000 } });
  assert.match(q.number, /^Q-\d{4}-0001$/);
  await store.addVersion(q.id, { tier: "expedited", depositPct: 30, lines: [line()], subtotalCents: 12000, depositCents: 3600 }, 1);
  await assert.rejects(store.addVersion(q.id, { tier: "standard", depositPct: 30, lines: [line()], subtotalCents: 1, depositCents: 1 }, 1), store.ConflictError);
  await store.setCheckout(q.id, { provider: "stripe", reference: "cs_1", amountCents: 3600, version: 2 });
  const wrong = await store.recordPayment(q.id, { provider: "stripe", eventId: "e0", reference: "cs_1", amountCents: 100, currency: "USD" });
  assert.equal(wrong.quote!.status, "deposit_pending");
  const paid = await store.recordPayment(q.id, { provider: "stripe", eventId: "e1", reference: "cs_1", amountCents: 3600, currency: "USD" });
  assert.equal(paid.quote!.status, "deposit_paid");
  const again = await store.recordPayment(q.id, { provider: "stripe", eventId: "e1", reference: "cs_1", amountCents: 3600, currency: "USD" });
  assert.equal(again.duplicate, true);
  assert.equal((await store.getQuote(q.id))!.payments.length, 2);
  await assert.rejects(store.addVersion(q.id, { tier: "standard", depositPct: 30, lines: [line()], subtotalCents: 1, depositCents: 1 }), /paid deposit/);
});
