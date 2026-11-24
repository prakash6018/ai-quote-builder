// Stripe Checkout with plain fetch (no SDK) and webhook signature checks.
// Docs: https://docs.stripe.com/webhooks#verify-manually
import { createHmac, timingSafeEqual } from "node:crypto";

export interface CheckoutInput {
  amountCents: number;
  currency: string;
  quoteId: string;
  quoteNumber: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(input: CheckoutInput, secretKey: string): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": `Deposit for quote ${input.quoteNumber}`,
    "metadata[quoteId]": input.quoteId,
    "payment_intent_data[metadata][quoteId]": input.quoteId,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `deposit-${input.quoteId}-${input.amountCents}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Stripe returned ${res.status}`);
  return { id: body.id, url: body.url };
}

/** Builds a Stripe-Signature header. Used by tests and the offline demo. */
export function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Verifies a webhook against the raw request body. Rejects old timestamps to
 * stop replays. Returns the parsed event, or throws.
 */
export function verifyStripeWebhook(payload: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()): any {
  if (!header) throw new Error("missing Stripe-Signature header");
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length) throw new Error("malformed Stripe-Signature header");
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new Error("timestamp outside tolerance");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  const ok = sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new Error("signature mismatch");
  return JSON.parse(payload);
}
