// Shapes sent to the browser. Prices are always recomputed on the server.
import { priceQuote } from "./pricing.ts";
import { current, type Quote } from "./store.ts";
import { paymentModes } from "./config.ts";

export function quoteView(q: Quote) {
  const v = current(q);
  return {
    ...q,
    current: v,
    price: priceQuote(v.lines, v.tier, v.depositPct, q.currency, q.fxRate),
    paymentModes: paymentModes(),
  };
}

export function quoteSummary(q: Quote) {
  const v = current(q);
  return {
    id: q.id,
    number: q.number,
    customer: q.customer,
    status: q.status,
    currency: q.currency,
    createdAt: q.createdAt,
    version: v.version,
    parts: v.lines.length,
    units: v.lines.reduce((s, l) => s + l.quantity, 0),
    subtotalCents: v.subtotalCents,
    needsReview: v.lines.some((l) => !l.reviewed),
  };
}
