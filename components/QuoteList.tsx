"use client";
import Link from "next/link";
import { useQuotes } from "@/lib/api.ts";
import { money } from "@/lib/money.ts";
import { Alert, StatusBadge } from "./ui";

export function QuoteList() {
  const { data, error, isLoading } = useQuotes();
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-stone-500">Upload drawings, check what the AI read, price it, and collect a deposit.</p>
        </div>
      </div>
      {error && <Alert tone="error">{error.message}</Alert>}
      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-stone-200/60" />}
      {data && data.quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <p className="font-medium">No quotes yet</p>
          <p className="mt-1 text-sm text-stone-500">Start with a drawing, or try one of the sample drawings.</p>
          <Link href="/quotes/new" className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-white">New quote</Link>
        </div>
      )}
      {data && data.quotes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-stone-300/70 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Quote</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Parts</th>
                <th className="px-4 py-2.5 text-right font-medium">Units</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.quotes.map((q) => (
                <tr key={q.id} className="group hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-mono font-medium group-hover:underline">{q.number}</Link>
                    <span className="ml-2 text-xs text-stone-400">v{q.version}</span>
                  </td>
                  <td className="px-4 py-3">
                    {q.customer.name}
                    <div className="text-xs text-stone-500">{q.customer.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{q.parts}</td>
                  <td className="px-4 py-3 text-right">{q.units.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(q.subtotalCents, q.currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={q.status} />
                      {q.needsReview && <span className="text-xs text-amber-700">needs review</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
