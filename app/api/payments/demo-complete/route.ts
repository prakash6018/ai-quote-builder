// Offline stand-in for a payment provider. It builds the same event the
// provider would send, signs it with a per-process secret, and runs it through
// the real signature check and webhook handler. Disabled once real keys are set.
import { z } from "zod";
import { DEMO_WEBHOOK_SECRET, paymentModes } from "@/lib/config.ts";
import { handleRazorpayEvent, handleStripeEvent } from "@/lib/deposits.ts";
import { fail, json } from "@/lib/http.ts";
import { signStripePayload, verifyStripeWebhook } from "@/lib/payments/stripe.ts";
import { signRazorpayWebhook, verifyRazorpayWebhook } from "@/lib/payments/razorpay.ts";
import { getQuote } from "@/lib/store.ts";

const body = z.object({ quoteId: z.string().uuid(), provider: z.enum(["stripe", "razorpay"]) });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(400, "Invalid request.");
  if (paymentModes()[p.data.provider] !== "demo") return fail(404, "Demo payments are off because real keys are configured.");
  const q = await getQuote(p.data.quoteId);
  if (!q?.checkout || q.checkout.provider !== p.data.provider) return fail(409, "Start the deposit from the quote first.");
  const { reference, amountCents } = q.checkout;
  const n = crypto.randomUUID().slice(0, 12);

  if (p.data.provider === "stripe") {
    const raw = JSON.stringify({
      id: `evt_demo_${n}`,
      type: "checkout.session.completed",
      data: { object: { id: reference, payment_status: "paid", amount_total: amountCents, currency: q.currency.toLowerCase(), metadata: { quoteId: q.id } } },
    });
    const event = verifyStripeWebhook(raw, signStripePayload(raw, DEMO_WEBHOOK_SECRET), DEMO_WEBHOOK_SECRET);
    await handleStripeEvent(event);
  } else {
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_demo_${n}`, order_id: reference, status: "captured", amount: amountCents, currency: q.currency, notes: { quoteId: q.id } } } },
    });
    const event = verifyRazorpayWebhook(raw, signRazorpayWebhook(raw, DEMO_WEBHOOK_SECRET), DEMO_WEBHOOK_SECRET);
    await handleRazorpayEvent(event);
  }
  return json({ status: (await getQuote(q.id))?.status });
}
