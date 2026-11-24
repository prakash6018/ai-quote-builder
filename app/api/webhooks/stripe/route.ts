import { config } from "@/lib/config.ts";
import { handleStripeEvent } from "@/lib/deposits.ts";
import { verifyStripeWebhook } from "@/lib/payments/stripe.ts";

export async function POST(req: Request) {
  const secret = config.stripe().webhookSecret;
  if (!secret) return new Response("Stripe webhooks are not configured.", { status: 404 });
  const raw = await req.text(); // the signature covers the exact bytes, so read before parsing
  let event;
  try {
    event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"), secret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }
  await handleStripeEvent(event);
  return Response.json({ received: true });
}
