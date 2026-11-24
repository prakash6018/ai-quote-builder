import type { ReactNode } from "react";
import type { QuoteStatus } from "@/lib/store.ts";

export const inputCls = "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-blueprint focus:outline-none disabled:bg-stone-50 disabled:text-stone-500";

const statusStyle: Record<QuoteStatus, [string, string]> = {
  draft: ["Draft", "bg-stone-100 text-stone-700 ring-stone-500/20"],
  deposit_pending: ["Awaiting deposit", "bg-amber-50 text-amber-800 ring-amber-600/25"],
  deposit_paid: ["Deposit paid", "bg-emerald-50 text-emerald-700 ring-emerald-600/20"],
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const [label, cls] = statusStyle[status];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
}

export function Panel({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-300/70 bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Alert({ tone, children }: { tone: "error" | "warn" | "ok" | "info"; children: ReactNode }) {
  const cls = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-200 bg-blueprint-soft/60 text-blue-900",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
