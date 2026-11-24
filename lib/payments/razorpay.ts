// Razorpay Orders + payment and webhook signature checks, with plain fetch.
// Docs: https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/
import { createHmac, timingSafeEqual } from "node:crypto";

export async function createOrder(
  input: { amountMinor: number; currency: string; receipt: string; quoteId: string },
  keyId: string,
  keySecret: string,
): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"), "content-type": "application/json" },
    body: JSON.stringify({ amount: input.amountMinor, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: { quoteId: input.quoteId } }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.description ?? `Razorpay returned ${res.status}`);
  return { id: body.id, amount: body.amount, currency: body.currency };
}

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout callback: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

export const signPayment = (orderId: string, paymentId: string, keySecret: string) => hmacHex(keySecret, `${orderId}|${paymentId}`);

/** Webhooks: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyRazorpayWebhook(payload: string, signature: string | null, webhookSecret: string): any {
  if (!signature || !safeEqualHex(hmacHex(webhookSecret, payload), signature)) throw new Error("signature mismatch");
  return JSON.parse(payload);
}

export const signRazorpayWebhook = (payload: string, secret: string) => hmacHex(secret, payload);
