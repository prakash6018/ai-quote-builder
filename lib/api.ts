"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Currency, TierKey } from "./catalog.ts";
import type { QuotePrice } from "./pricing.ts";
import type { Line } from "./schemas.ts";
import type { Quote, QuoteStatus, QuoteVersion } from "./store.ts";

export interface QuoteSummary {
  id: string;
  number: string;
  customer: { name: string; email: string };
  status: QuoteStatus;
  currency: Currency;
  createdAt: string;
  version: number;
  parts: number;
  units: number;
  subtotalCents: number;
  needsReview: boolean;
}

export type QuoteView = Quote & {
  current: QuoteVersion;
  price: QuotePrice;
  paymentModes: { stripe: "live" | "demo"; razorpay: "live" | "demo" };
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  return body as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const useQuotes = () => useQuery({ queryKey: ["quotes"], queryFn: () => call<{ quotes: QuoteSummary[] }>("/api/quotes") });

export const useQuote = (id: string) => useQuery({ queryKey: ["quote", id], queryFn: () => call<QuoteView>(`/api/quotes/${id}`) });

export function useCreateQuote() {
  return useMutation({ mutationFn: (form: FormData) => call<{ id: string; problems: string[] }>("/api/quotes", { method: "POST", body: form }) });
}

export function useSaveQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { expectedVersion: number; tier: TierKey; depositPct: number; note?: string; lines: Line[] }) => call<QuoteView>(`/api/quotes/${id}`, jsonInit("PUT", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export type DepositStart =
  | { mode: "demo" | "live"; redirectUrl: string }
  | { mode: "live"; razorpay: { keyId: string; orderId: string; amount: number; currency: string; name: string; email: string } };

export function useStartDeposit(id: string) {
  return useMutation({ mutationFn: (provider: "stripe" | "razorpay") => call<DepositStart>(`/api/quotes/${id}/deposit`, jsonInit("POST", { provider })) });
}

export const confirmRazorpay = (body: Record<string, string>) => call<{ status: string }>("/api/payments/razorpay/verify", jsonInit("POST", body));
export const completeDemoPayment = (quoteId: string, provider: string) => call<{ status: string }>("/api/payments/demo-complete", jsonInit("POST", { quoteId, provider }));
