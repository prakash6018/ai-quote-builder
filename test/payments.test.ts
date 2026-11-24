import { test } from "node:test";
import assert from "node:assert/strict";
import { signStripePayload, verifyStripeWebhook } from "../lib/payments/stripe.ts";
import { signPayment, signRazorpayWebhook, verifyPaymentSignature, verifyRazorpayWebhook } from "../lib/payments/razorpay.ts";

test("stripe webhook signatures", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const header = signStripePayload(body, "whsec_test");
  assert.equal(verifyStripeWebhook(body, header, "whsec_test").id, "evt_1");
  assert.throws(() => verifyStripeWebhook(body + " ", header, "whsec_test"), /mismatch/);
  assert.throws(() => verifyStripeWebhook(body, header, "whsec_other"), /mismatch/);
  const old = signStripePayload(body, "whsec_test", Math.floor(Date.now() / 1000) - 3600);
  assert.throws(() => verifyStripeWebhook(body, old, "whsec_test"), /tolerance/);
  assert.throws(() => verifyStripeWebhook(body, null, "whsec_test"), /missing/);
});

test("razorpay payment and webhook signatures", () => {
  const sig = signPayment("order_1", "pay_1", "secret");
  assert.equal(verifyPaymentSignature("order_1", "pay_1", sig, "secret"), true);
  assert.equal(verifyPaymentSignature("order_1", "pay_2", sig, "secret"), false);
  const body = '{"event":"payment.captured"}';
  assert.equal(verifyRazorpayWebhook(body, signRazorpayWebhook(body, "wh"), "wh").event, "payment.captured");
  assert.throws(() => verifyRazorpayWebhook(body, "00", "wh"));
});
