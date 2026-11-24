"use client";
import { useState, type ReactNode } from "react";
import { FINISHES, MATERIALS, PROCESSES, TIERS, TOLERANCES, type Currency, type TierKey } from "@/lib/catalog.ts";
import { money } from "@/lib/money.ts";
import { applyMargin, type LinePrice } from "@/lib/pricing.ts";
import { REVIEW_THRESHOLD, type Line } from "@/lib/schemas.ts";
import { inputCls } from "./ui";

interface Props {
  line: Line;
  index: number;
  price?: LinePrice;
  errors: Record<string, string>;
  currency: Currency;
  tier: TierKey;
  locked: boolean;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
  onOpenDrawing: (sha: string) => void;
}

const LABELS: Record<string, string> = {
  partName: "part name", process: "process", material: "material", lengthMm: "length", widthMm: "width",
  heightMm: "height", quantity: "quantity", finish: "finish", tolerance: "tolerance", holes: "holes", bends: "bends",
};

export function LineCard({ line, index, price, errors, currency, tier, locked, onChange, onRemove, onOpenDrawing }: Props) {
  const [details, setDetails] = useState(false);
  const flagged = (k: string) => !line.reviewed && (line.confidence[k] ?? 1) < REVIEW_THRESHOLD;
  const flaggedFields = Object.keys(LABELS).filter(flagged);
  const sheet = line.process === "sheet";

  const field = (k: keyof Line, label: string, el: ReactNode, span: string) => (
    <label className={`relative min-w-0 text-xs ${span}`}>
      <span className="mb-1 flex items-center gap-1.5 whitespace-nowrap font-medium text-stone-600">
        {label}
        {line.confidence[k] !== undefined && (
          <span className={`font-normal ${flagged(k) ? "text-amber-700" : "text-stone-400"}`} title="How sure the drawing reader was">
            {Math.round(line.confidence[k] * 100)}%
          </span>
        )}
      </span>
      <div className={flagged(k) ? "rounded-md ring-2 ring-amber-400 ring-offset-1" : ""}>{el}</div>
      {errors[k] && <span className="mt-0.5 block text-[11px] text-rose-700">{errors[k]}</span>}
    </label>
  );
  const num = (k: "lengthMm" | "widthMm" | "heightMm" | "quantity" | "holes" | "bends", step = "1") => (
    <input
      type="number"
      step={step}
      min={0}
      disabled={locked}
      value={Number.isFinite(line[k]) ? line[k] : ""}
      onChange={(e) => onChange({ [k]: e.target.value === "" ? NaN : Number(e.target.value) } as Partial<Line>)}
      className={`${inputCls} font-mono`}
    />
  );
  const select = (k: "process" | "material" | "finish" | "tolerance", options: Record<string, { label: string }>) => (
    <select disabled={locked} value={line[k]} onChange={(e) => onChange({ [k]: e.target.value } as Partial<Line>)} className={inputCls}>
      {Object.entries(options).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
    </select>
  );

  return (
    <article className={`overflow-hidden rounded-xl border bg-white ${flaggedFields.length ? "border-amber-300" : "border-stone-300/70"}`} aria-label={`Line ${index + 1}: ${line.partName}`}>
      {flaggedFields.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <span>
            Check {flaggedFields.map((k) => LABELS[k]).join(", ")}: the drawing reader wasn't sure.
          </span>
          {!locked && (
            <button onClick={() => onChange({ reviewed: true })} className="shrink-0 rounded-md bg-white px-2.5 py-1 font-medium ring-1 ring-amber-300 hover:bg-amber-100">
              Looks right
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[130px_1fr_170px]">
        <div>
          {line.drawing ? (
            <button onClick={() => onOpenDrawing(line.drawing!)} className="group block w-full overflow-hidden rounded-lg border border-stone-200 bg-white" aria-label="Open drawing">
              <img src={`/api/files/${line.drawing}`} alt={`Drawing for ${line.partName}`} className="aspect-[1.41] w-full object-cover object-left-top transition group-hover:scale-[1.03]" />
            </button>
          ) : (
            <div className="grid aspect-[1.41] place-items-center rounded-lg border border-dashed border-stone-300 text-[11px] text-stone-400">No drawing</div>
          )}
          <div className="mt-2 font-mono text-[11px] text-stone-400">Line {index + 1}</div>
        </div>

        <div className="grid grid-cols-6 content-start gap-x-3 gap-y-2.5">
          {field("partName", "Part", <input disabled={locked} value={line.partName} onChange={(e) => onChange({ partName: e.target.value })} className={inputCls} />, "col-span-4")}
          {field("quantity", "Quantity", num("quantity"), "col-span-2")}
          {field("process", "Process", select("process", PROCESSES), "col-span-3")}
          {field("material", "Material", select("material", MATERIALS), "col-span-3")}
          {field("lengthMm", "Length mm", num("lengthMm", "0.1"), "col-span-2")}
          {field("widthMm", "Width mm", num("widthMm", "0.1"), "col-span-2")}
          {field("heightMm", sheet ? "Thickness mm" : "Height mm", num("heightMm", "0.1"), "col-span-2")}
          {field("finish", "Finish", select("finish", FINISHES), "col-span-2")}
          {field("tolerance", "Tolerance", select("tolerance", TOLERANCES), "col-span-2")}
          {field("holes", "Holes", num("holes"), sheet ? "col-span-1" : "col-span-2")}
          {sheet && field("bends", "Bends", num("bends"), "col-span-1")}
        </div>

        <div className="flex flex-col border-t border-stone-100 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          {price ? (
            <>
              <div className="text-xs text-stone-500">Unit price</div>
              <div className="text-lg font-semibold tracking-tight">{money(price.unitPriceCents, currency)}</div>
              <div className="mt-1 text-xs text-stone-500">× {line.quantity.toLocaleString()} = <span className="font-medium text-ink">{money(price.totalCents, currency)}</span></div>
              <div className="mt-1 text-xs text-stone-500">{price.leadDays} working days · {TIERS[tier].label}</div>
              <button onClick={() => setDetails(!details)} aria-expanded={details} className="mt-3 self-start text-xs font-medium text-blueprint hover:underline">
                {details ? "Hide" : "Show"} breakdown
              </button>
            </>
          ) : (
            <div className="text-xs text-rose-700">Fix the highlighted fields to price this part.</div>
          )}
          {!locked && (
            <button onClick={onRemove} className="mt-auto self-start pt-3 text-xs text-stone-400 hover:text-rose-700">
              Remove line
            </button>
          )}
        </div>
      </div>

      {details && price && (
        <div className="grid grid-cols-1 gap-6 border-t border-stone-100 bg-stone-50/60 px-4 py-3 text-xs md:grid-cols-2">
          <table className="w-full">
            <caption className="mb-1 text-left font-medium text-stone-600">Cost per part (USD, before margin)</caption>
            <tbody className="[&_td]:py-0.5">
              <tr><td className="text-stone-500">Material ({price.unit.massKg} kg stock)</td><td className="text-right font-mono">{money(price.unit.materialCents, "USD")}</td></tr>
              <tr><td className="text-stone-500">Machine time ({price.unit.minutes} min)</td><td className="text-right font-mono">{money(price.unit.machiningCents, "USD")}</td></tr>
              <tr><td className="text-stone-500">Finish</td><td className="text-right font-mono">{money(price.unit.finishCents, "USD")}</td></tr>
              <tr><td className="text-stone-500">Setup, spread over {line.quantity}</td><td className="text-right font-mono">{money(price.unit.setupPerUnitCents, "USD")}</td></tr>
              <tr className="border-t border-stone-200 font-medium"><td>Cost</td><td className="text-right font-mono">{money(price.unit.costCents, "USD")}</td></tr>
              <tr><td className="text-stone-500">Margin ({Math.round(TIERS[tier].margin * 100)}% of price)</td><td className="text-right font-mono">{money(applyMargin(price.unit.costCents, TIERS[tier].margin) - price.unit.costCents, "USD")}</td></tr>
              <tr className="border-t border-stone-200 font-medium"><td>Price per part (USD)</td><td className="text-right font-mono">{money(applyMargin(price.unit.costCents, TIERS[tier].margin), "USD")}</td></tr>
            </tbody>
          </table>
          <table className="w-full">
            <caption className="mb-1 text-left font-medium text-stone-600">Price breaks</caption>
            <thead className="text-stone-500"><tr><th className="text-left font-normal">Qty</th><th className="text-right font-normal">Unit</th><th className="text-right font-normal">vs qty 1</th></tr></thead>
            <tbody className="[&_td]:py-0.5">
              {price.breaks.map((b) => (
                <tr key={b.qty} className={line.quantity >= b.qty && (price.breaks.find((x) => x.qty > b.qty)?.qty ?? Infinity) > line.quantity ? "font-medium text-blueprint" : ""}>
                  <td>{b.qty}+</td>
                  <td className="text-right font-mono">{money(b.unitPriceCents, currency)}</td>
                  <td className="text-right font-mono text-stone-500">{b.qty === 1 ? "—" : `-${Math.round((1 - b.unitPriceCents / price.breaks[0].unitPriceCents) * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
