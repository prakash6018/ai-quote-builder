// Turning verified payment events into "deposit paid". Both providers end up
// in recordPayment, which is idempotent and checks the amount.
import type { Currency } from "./catalog.ts";
import { recordPayment } from "./store.ts";

export async function handleStripeEvent(event: any) {
  if (event?.type !== "checkout.session.completed") return { ignored: true };
  const s = event.data?.object ?? {};
  if (s.payment_status !== "paid" || !s.metadata?.quoteId) return { ignored: true };
  return recordPayment(s.metadata.quoteId, {
    provider: "stripe",
    eventId: `stripe:${event.id}`,
    reference: s.id,
    amountCents: s.amount_total,
    currency: String(s.currency).toUpperCase() as Currency,
  });
}

export async function handleRazorpayEvent(event: any) {
  if (event?.event !== "payment.captured" && event?.event !== "order.paid") return { ignored: true };
  const p = event.payload?.payment?.entity ?? {};
  const quoteId = p.notes?.quoteId ?? event.payload?.order?.entity?.notes?.quoteId;
  if (!quoteId || p.status !== "captured") return { ignored: true };
  // order.paid and payment.captured both fire for one payment: key on the payment id.
  return recordPayment(quoteId, {
    provider: "razorpay",
    eventId: `razorpay:${p.id}`,
    reference: p.order_id ?? p.id,
    amountCents: p.amount,
    currency: String(p.currency).toUpperCase() as Currency,
  });
}
