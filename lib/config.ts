// Runtime configuration from environment variables. Payment providers and the
// vision model switch on automatically when their keys are present; without
// them the app runs in demo mode (sample extractor, simulated checkout).
import { SampleExtractor, VisionExtractor, type Extractor } from "./extract.ts";
import { SAMPLE_EXTRACTIONS } from "./samples.ts";

export const config = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  fxUsdInr: () => Number(process.env.FX_USD_INR ?? 84),
  stripe: () => ({ secretKey: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }),
  razorpay: () => ({ keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET }),
};

export function extractor(): Extractor {
  const key = process.env.OPENAI_API_KEY;
  if (key) return new VisionExtractor(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1", key, process.env.VISION_MODEL ?? "gpt-4o");
  return new SampleExtractor(SAMPLE_EXTRACTIONS);
}

/** Which deposit options are live; anything not configured runs as a simulation. */
export function paymentModes() {
  const s = config.stripe();
  const r = config.razorpay();
  return {
    stripe: s.secretKey && s.webhookSecret ? ("live" as const) : ("demo" as const),
    razorpay: r.keyId && r.keySecret ? ("live" as const) : ("demo" as const),
  };
}

/** Secret used to sign simulated webhooks in demo mode; generated per process. */
export const DEMO_WEBHOOK_SECRET = "demo_" + crypto.randomUUID();
