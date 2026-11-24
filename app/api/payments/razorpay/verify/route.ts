// Razorpay Checkout's success callback. The signature proves the payment id
// belongs to our order; the webhook later confirms capture (same event key, so
// whichever arrives second is ignored).
import { z } from "zod";
import { config } from "@/lib/config.ts";
import { fail, json } from "@/lib/http.ts";
import { verifyPaymentSignature } from "@/lib/payments/razorpay.ts";
import { getQuote, recordPayment } from "@/lib/store.ts";

const body = z.object({
  quoteId: z.string().uuid(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(400, "Invalid payment confirmation.");
  const secret = config.razorpay().keySecret;
  if (!secret) return fail(404, "Razorpay is not configured.");
  const q = await getQuote(p.data.quoteId);
  if (!q || q.checkout?.provider !== "razorpay" || q.checkout.reference !== p.data.razorpay_order_id) return fail(400, "This payment isn't for this quote.");
  if (!verifyPaymentSignature(p.data.razorpay_order_id, p.data.razorpay_payment_id, p.data.razorpay_signature, secret))
    return fail(400, "Payment signature didn't verify.");
  const r = await recordPayment(q.id, {
    provider: "razorpay",
    eventId: `razorpay:${p.data.razorpay_payment_id}`,
    reference: p.data.razorpay_order_id,
    amountCents: q.checkout.amountCents,
    currency: q.currency,
  });
  return json({ status: r.quote?.status });
}
