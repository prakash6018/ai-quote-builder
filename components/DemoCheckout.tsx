"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { completeDemoPayment, useQuote } from "@/lib/api.ts";
import { money } from "@/lib/money.ts";
import { Alert } from "./ui";

/** A stand-in checkout page used when no payment keys are configured. */
export function DemoCheckout() {
  const params = useSearchParams();
  const router = useRouter();
  const quoteId = params.get("quote") ?? "";
  const provider = params.get("provider") === "razorpay" ? "razorpay" : "stripe";
  const { data } = useQuote(quoteId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await completeDemoPayment(quoteId, provider);
      router.push(`/quotes/${quoteId}?paid=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const amount = data?.checkout ? money(data.checkout.amountCents, data.currency) : "…";
  return (
    <div className="mx-auto mt-6 max-w-md">
      <Alert tone="info">
        Simulated {provider === "stripe" ? "Stripe Checkout" : "Razorpay Checkout"}. No real payment is taken. Paying sends a signed webhook through the same verification code a real {provider === "stripe" ? "Stripe" : "Razorpay"} event would use.
      </Alert>
      <div className="mt-4 rounded-xl border border-stone-300/70 bg-white p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-stone-500">{provider === "stripe" ? "Stripe test mode" : "Razorpay test mode"}</div>
        <div className="mt-3 text-sm text-stone-600">Deposit for quote <span className="font-mono">{data?.number}</span></div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">{amount}</div>
        <div className="mt-1 text-sm text-stone-500">{data?.customer.name} · {data?.customer.email}</div>
        <div className="mt-5 space-y-2 rounded-lg bg-stone-50 p-3 font-mono text-xs text-stone-600">
          <div>{provider === "stripe" ? "Card 4242 4242 4242 4242 · 12/34 · 123" : "UPI success@razorpay"}</div>
        </div>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        <button onClick={pay} disabled={busy || !data} className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 ${provider === "stripe" ? "bg-[#635bff] hover:bg-[#5249e0]" : "bg-[#0c2451] hover:bg-[#13306a]"}`}>
          {busy ? "Processing…" : `Pay ${amount}`}
        </button>
        <button onClick={() => router.push(`/quotes/${quoteId}`)} className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
