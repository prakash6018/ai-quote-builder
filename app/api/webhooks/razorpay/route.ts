import { config } from "@/lib/config.ts";
import { handleRazorpayEvent } from "@/lib/deposits.ts";
import { verifyRazorpayWebhook } from "@/lib/payments/razorpay.ts";

export async function POST(req: Request) {
  const secret = config.razorpay().webhookSecret;
  if (!secret) return new Response("Razorpay webhooks are not configured.", { status: 404 });
  const raw = await req.text();
  let event;
  try {
    event = verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), secret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }
  await handleRazorpayEvent(event);
  return Response.json({ received: true });
}
