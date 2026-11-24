// Starts a deposit payment for the saved version of a quote.
import { z } from "zod";
import { config, paymentModes } from "@/lib/config.ts";
import { fail, isUuid, json } from "@/lib/http.ts";
import { createCheckoutSession } from "@/lib/payments/stripe.ts";
import { createOrder } from "@/lib/payments/razorpay.ts";
import { current, getQuote, setCheckout } from "@/lib/store.ts";

const body = z.object({ provider: z.enum(["stripe", "razorpay"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Choose stripe or razorpay.");
  const q = isUuid(id) ? await getQuote(id) : undefined;
  if (!q) return fail(404, "Quote not found.");
  if (q.status === "deposit_paid") return fail(409, "The deposit is already paid.");
  const v = current(q);
  if (v.lines.some((l) => !l.reviewed)) return fail(409, "Review the flagged fields before asking for a deposit.");
  if (v.depositCents <= 0) return fail(409, "Set a deposit percentage above 0.");

  const provider = parsed.data.provider;
  const mode = paymentModes()[provider];
  const amountCents = v.depositCents;

  if (mode === "demo") {
    const reference = `demo_${provider}_${crypto.randomUUID().slice(0, 8)}`;
    await setCheckout(id, { provider, reference, amountCents, version: v.version });
    return json({ mode, redirectUrl: `/pay/demo?quote=${id}&provider=${provider}` });
  }

  try {
    if (provider === "stripe") {
      const session = await createCheckoutSession(
        {
          amountCents,
          currency: q.currency,
          quoteId: q.id,
          quoteNumber: q.number,
          customerEmail: q.customer.email,
          successUrl: `${config.appUrl()}/quotes/${q.id}?paid=1`,
          cancelUrl: `${config.appUrl()}/quotes/${q.id}`,
        },
        config.stripe().secretKey!,
      );
      await setCheckout(id, { provider, reference: session.id, amountCents, version: v.version });
      return json({ mode, redirectUrl: session.url });
    }
    const r = config.razorpay();
    const order = await createOrder({ amountMinor: amountCents, currency: q.currency, receipt: q.number, quoteId: q.id }, r.keyId!, r.keySecret!);
    await setCheckout(id, { provider, reference: order.id, amountCents, version: v.version });
    // The browser opens Razorpay Checkout with these; the key id is public by design.
    return json({ mode, razorpay: { keyId: r.keyId, orderId: order.id, amount: order.amount, currency: order.currency, name: q.number, email: q.customer.email } });
  } catch (e) {
    return fail(502, `Payment provider error: ${(e as Error).message}`);
  }
}
