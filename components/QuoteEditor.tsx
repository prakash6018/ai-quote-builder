"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { TIERS, type TierKey } from "@/lib/catalog.ts";
import { confirmRazorpay, useQuote, useSaveQuote, useStartDeposit, type QuoteView } from "@/lib/api.ts";
import { importCsv, toCsv } from "@/lib/csv.ts";
import { money } from "@/lib/money.ts";
import { priceQuote } from "@/lib/pricing.ts";
import { lineSchema, type Line } from "@/lib/schemas.ts";
import { LineCard } from "./LineCard";
import { Alert, inputCls, Panel, StatusBadge } from "./ui";

export function QuoteEditor({ id }: { id: string }) {
  const { data, error, isLoading } = useQuote(id);
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-xl bg-stone-200/60" />;
  // Re-mount the editor when a new version is saved, so the draft resets to it.
  return <Editor key={`${data.current.version}-${data.status}`} quote={data} />;
}

const newLine = (): Line => ({
  id: crypto.randomUUID(), partName: "New part", drawing: null, process: "cnc", material: "al-6061",
  lengthMm: 100, widthMm: 50, heightMm: 10, quantity: 1, finish: "none", tolerance: "standard", holes: 0, bends: 0, confidence: {}, reviewed: true,
});

function Editor({ quote }: { quote: QuoteView }) {
  const params = useSearchParams();
  const router = useRouter();
  const save = useSaveQuote(quote.id);
  const deposit = useStartDeposit(quote.id);
  const [lines, setLines] = useState<Line[]>(quote.current.lines);
  const [tier, setTier] = useState<TierKey>(quote.current.tier);
  const [depositPct, setDepositPct] = useState(quote.current.depositPct);
  const [note, setNote] = useState("");
  const [drawing, setDrawing] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [imported, setImported] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const locked = quote.status === "deposit_paid";
  const dirty = JSON.stringify({ lines, tier, depositPct }) !== JSON.stringify({ lines: quote.current.lines, tier: quote.current.tier, depositPct: quote.current.depositPct });

  const checks = useMemo(() => lines.map((l) => lineSchema.safeParse(l)), [lines]);
  const errorsFor = (i: number) => {
    const c = checks[i];
    if (c.success) return {};
    return Object.fromEntries(c.error.issues.map((x) => [String(x.path[0]), x.message]));
  };
  const valid = checks.flatMap((c) => (c.success ? [c.data] : []));
  const price = useMemo(() => priceQuote(valid, tier, depositPct, quote.currency, quote.fxRate), [JSON.stringify(valid), tier, depositPct]);
  const priceById = new Map(price.lines.map((p) => [p.lineId, p]));
  const tierTotals = useMemo(
    () => Object.fromEntries((Object.keys(TIERS) as TierKey[]).map((t) => [t, priceQuote(valid, t, depositPct, quote.currency, quote.fxRate)])),
    [JSON.stringify(valid), depositPct],
  );
  const invalidCount = checks.filter((c) => !c.success).length;
  const reviewCount = lines.filter((l) => !l.reviewed).length;

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function exportCsv() {
    const blob = new Blob([toCsv(valid, new Map(price.lines.map((p) => [p.lineId, p])))], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${quote.number}-v${quote.current.version}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport(file: File) {
    const r = importCsv(await file.text(), () => crypto.randomUUID());
    setImportErrors(r.errors);
    setImported(r.lines.length);
    if (r.lines.length) setLines((ls) => [...ls, ...r.lines]);
  }

  function submit() {
    if (invalidCount) return;
    save.mutate({ expectedVersion: quote.current.version, tier, depositPct, note: note.trim() || undefined, lines });
  }

  async function startDeposit(provider: "stripe" | "razorpay") {
    const r = await deposit.mutateAsync(provider);
    if ("redirectUrl" in r) {
      window.location.href = r.redirectUrl;
      return;
    }
    // Live Razorpay: open Checkout in the page, then verify the signature on our server.
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    const rz = new (window as any).Razorpay({
      key: r.razorpay.keyId,
      order_id: r.razorpay.orderId,
      amount: r.razorpay.amount,
      currency: r.razorpay.currency,
      name: "QuoteBench",
      description: `Deposit for ${r.razorpay.name}`,
      prefill: { email: r.razorpay.email },
      handler: async (resp: Record<string, string>) => {
        await confirmRazorpay({ quoteId: quote.id, ...resp });
        router.refresh();
        window.location.reload();
      },
    });
    rz.open();
  }

  const history = [...quote.versions].reverse();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{quote.number}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {quote.customer.name} · {quote.customer.email} · version {quote.current.version}
            {quote.currency === "INR" && <> · ₹{quote.fxRate}/USD</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          {!locked && <button onClick={() => fileInput.current?.click()} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Import CSV</button>}
          <button onClick={exportCsv} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Export CSV</button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {params.get("problems") && <Alert tone="warn">Some files weren't read: {params.get("problems")}</Alert>}
        {(params.get("paid") || locked) && quote.status === "deposit_paid" && (
          <Alert tone="ok">
            Deposit received{quote.payments.filter((p) => p.matchesDeposit).map((p) => ` via ${p.provider === "stripe" ? "Stripe" : "Razorpay"} (${money(p.amountCents, p.currency)}, ref ${p.reference})`)}. This version is locked for production.
          </Alert>
        )}
        {params.get("paid") && quote.status !== "deposit_paid" && <Alert tone="info">Waiting for the payment provider to confirm. This page updates when the webhook arrives.</Alert>}
        {imported > 0 && <Alert tone="ok">Imported {imported} line{imported > 1 ? "s" : ""} from CSV. Save to keep them.</Alert>}
        {importErrors.length > 0 && (
          <Alert tone="error">
            <div className="font-medium">{importErrors.length} row{importErrors.length > 1 ? "s" : ""} couldn't be imported:</div>
            <ul className="mt-1 list-inside list-disc">
              {importErrors.slice(0, 8).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
            </ul>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {lines.map((l, i) => (
            <LineCard
              key={l.id}
              line={l}
              index={i}
              price={priceById.get(l.id)}
              errors={errorsFor(i)}
              currency={quote.currency}
              tier={tier}
              locked={locked}
              onChange={(p) => update(i, p)}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
              onOpenDrawing={setDrawing}
            />
          ))}
          {!locked && (
            <button onClick={() => setLines([...lines, newLine()])} className="w-full rounded-xl border-2 border-dashed border-stone-300 py-3 text-sm font-medium text-stone-600 hover:border-blueprint hover:text-blueprint">
              + Add a part
            </button>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <Panel title="Pricing">
            <fieldset disabled={locked}>
              <legend className="sr-only">Service tier</legend>
              <div className="space-y-2">
                {(Object.keys(TIERS) as TierKey[]).map((t) => (
                  <label key={t} className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${tier === t ? "border-blueprint bg-blueprint-soft/40 ring-1 ring-blueprint" : "border-stone-200 hover:border-stone-300"}`}>
                    <span className="flex items-center gap-2.5">
                      <input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)} className="accent-blue-800" />
                      <span>
                        <span className="font-medium">{TIERS[t].label}</span>
                        <span className="block text-xs text-stone-500">{tierTotals[t].leadDays} working days</span>
                      </span>
                    </span>
                    <span className="font-mono text-sm">{money(tierTotals[t].subtotalCents, quote.currency)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <dl className="mt-4 space-y-1.5 border-t border-stone-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Parts</dt><dd>{valid.length} lines · {valid.reduce((s, l) => s + l.quantity, 0).toLocaleString()} units</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{money(price.subtotalCents, quote.currency)}</dd></div>
              <div className="flex items-center justify-between">
                <dt className="text-stone-500">
                  Deposit
                  <input type="number" min={0} max={100} disabled={locked} value={depositPct} onChange={(e) => setDepositPct(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} className="mx-1.5 w-12 rounded border border-stone-300 px-1 py-0.5 text-center text-xs" aria-label="Deposit percent" />%
                </dt>
                <dd className="font-medium">{money(price.depositCents, quote.currency)}</dd>
              </div>
            </dl>
            {!locked && (
              <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? (optional)" className={inputCls} maxLength={500} />
                {invalidCount > 0 && <p className="text-xs text-rose-700">{invalidCount} line{invalidCount > 1 ? "s have" : " has"} errors.</p>}
                {save.error && <p className="text-xs text-rose-700">{save.error.message}</p>}
                <button onClick={submit} disabled={!dirty || invalidCount > 0 || save.isPending} className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40">
                  {save.isPending ? "Saving…" : dirty ? `Save as version ${quote.current.version + 1}` : "No changes"}
                </button>
              </div>
            )}
          </Panel>

          {!locked && (
            <Panel title="Collect deposit">
              {dirty ? (
                <p className="text-sm text-stone-500">Save your changes first. The deposit is taken on a saved version.</p>
              ) : reviewCount > 0 ? (
                <p className="text-sm text-amber-800">{reviewCount} line{reviewCount > 1 ? "s need" : " needs"} a check before you can ask for money.</p>
              ) : (
                <>
                  <p className="text-sm text-stone-600">
                    Ask {quote.customer.name} for <span className="font-medium text-ink">{money(quote.price.depositCents, quote.currency)}</span> on version {quote.current.version}.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["stripe", "razorpay"] as const).map((p) => (
                      <button key={p} onClick={() => startDeposit(p)} disabled={deposit.isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50">
                        {p === "stripe" ? "Stripe" : "Razorpay"}
                        <span className="block text-[10px] font-normal uppercase tracking-wider text-stone-400">{quote.paymentModes[p] === "live" ? "live keys" : "demo"}</span>
                      </button>
                    ))}
                  </div>
                  {quote.status === "deposit_pending" && quote.checkout && <p className="mt-2 text-xs text-stone-500">A {quote.checkout.provider} checkout is open ({quote.checkout.reference}).</p>}
                  {deposit.error && <p className="mt-2 text-xs text-rose-700">{deposit.error.message}</p>}
                </>
              )}
            </Panel>
          )}

          <Panel title="Versions">
            <ol className="space-y-2.5 text-sm">
              {history.map((v, i) => {
                const prev = history[i + 1];
                const delta = prev ? v.subtotalCents - prev.subtotalCents : 0;
                return (
                  <li key={v.version} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">v{v.version} <span className="font-normal text-stone-500">· {TIERS[v.tier].label}</span></div>
                      <div className="truncate text-xs text-stone-500" title={v.note}>{v.note ?? `${v.lines.length} lines`}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs">{money(v.subtotalCents, quote.currency)}</div>
                      {prev && delta !== 0 && <div className={`font-mono text-[11px] ${delta > 0 ? "text-rose-700" : "text-emerald-700"}`}>{delta > 0 ? "+" : "−"}{money(Math.abs(delta), quote.currency)}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </aside>
      </div>

      {drawing && (
        <div role="dialog" aria-modal="true" aria-label="Drawing" onClick={() => setDrawing(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
          <img src={`/api/files/${drawing}`} alt="Engineering drawing" className="max-h-full max-w-full rounded-lg bg-white shadow-2xl" />
        </div>
      )}
    </>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window."));
    document.head.appendChild(s);
  });
}
