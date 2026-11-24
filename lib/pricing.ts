// The estimating model. Everything is computed in USD cents (integers) and
// converted once at the end, so totals never drift from rounding.
import { FINISHES, MATERIALS, PROCESSES, QUANTITY_BREAKS, TIERS, TOLERANCES, type Currency, type TierKey } from "./catalog.ts";
import type { Line } from "./schemas.ts";

const STOCK_ALLOWANCE_MM = 3; // extra stock on each axis
const SCRAP = 0.1;

export interface UnitBreakdown {
  materialCents: number;
  machiningCents: number;
  finishCents: number;
  setupPerUnitCents: number;
  costCents: number;
  minutes: number;
  massKg: number;
}

export interface LinePrice {
  lineId: string;
  unit: UnitBreakdown;
  unitPriceCents: number;
  totalCents: number;
  leadDays: number;
  breaks: { qty: number; unitPriceCents: number }[];
}

export interface QuotePrice {
  currency: Currency;
  tier: TierKey;
  lines: LinePrice[];
  subtotalCents: number;
  depositCents: number;
  leadDays: number;
}

const cents = (usd: number) => Math.round(usd * 100);

function runDiscount(qty: number): number {
  let d = 0;
  for (const b of QUANTITY_BREAKS) if (qty >= b.minQty) d = b.runDiscount;
  return d;
}

/** Machine minutes for one part. */
export function machineMinutes(line: Line): number {
  const m = MATERIALS[line.material];
  const tol = TOLERANCES[line.tolerance].factor;
  if (line.process === "cnc") {
    const envelopeCm3 = (line.lengthMm * line.widthMm * line.heightMm) / 1000;
    // Base handling + time that grows with part size (sublinear) + drilled features.
    const minutes = 6 + 1.2 * Math.cbrt(envelopeCm3) ** 1.6 + line.holes * 1.2;
    return minutes * m.machinability * tol;
  }
  // Sheet: laser-cut perimeter, then bends and holes.
  const perimeterM = (2 * (line.lengthMm + line.widthMm)) / 1000;
  const minutes = 3 + perimeterM * 0.9 * (line.heightMm / 2) + line.bends * 0.8 + line.holes * 0.25;
  return minutes * m.machinability * tol;
}

export function unitCost(line: Line, qty = line.quantity): UnitBreakdown {
  const m = MATERIALS[line.material];
  const p = PROCESSES[line.process];
  const a = STOCK_ALLOWANCE_MM;
  const stockCm3 =
    line.process === "cnc"
      ? ((line.lengthMm + a) * (line.widthMm + a) * (line.heightMm + a)) / 1000
      : ((line.lengthMm + a) * (line.widthMm + a) * line.heightMm) / 1000; // height = sheet thickness
  const massKg = (stockCm3 * m.densityGcm3) / 1000;
  const materialCents = cents(massKg * m.usdPerKg * (1 + SCRAP));

  const minutes = machineMinutes(line);
  const machiningCents = cents((minutes / 60) * p.machineUsdPerHour * (1 - runDiscount(qty)));

  const f = FINISHES[line.finish];
  const areaCm2 = (2 * (line.lengthMm * line.widthMm + line.lengthMm * line.heightMm + line.widthMm * line.heightMm)) / 100;
  const finishCents = line.finish === "none" ? 0 : cents(Math.max(f.minUsd, areaCm2 * f.usdPerCm2));

  const setupPerUnitCents = Math.ceil(cents(p.setupUsd) / qty);
  return {
    materialCents,
    machiningCents,
    finishCents,
    setupPerUnitCents,
    costCents: materialCents + machiningCents + finishCents + setupPerUnitCents,
    minutes: Math.round(minutes * 10) / 10,
    massKg: Math.round(massKg * 1000) / 1000,
  };
}

/** Price = cost / (1 - margin), so the margin is a share of the price, as finance reports it. */
export const applyMargin = (costCents: number, margin: number) => Math.ceil(costCents / (1 - margin));

export function convert(usdCents: number, currency: Currency, fxRate: number): number {
  return currency === "USD" ? usdCents : Math.round(usdCents * fxRate);
}

export function priceLine(line: Line, tier: TierKey, currency: Currency, fxRate: number): LinePrice {
  const t = TIERS[tier];
  const unit = unitCost(line);
  const unitPriceCents = convert(applyMargin(unit.costCents, t.margin), currency, fxRate);
  const extraDays = line.quantity >= 100 ? 3 : line.quantity >= 50 ? 1 : 0;
  return {
    lineId: line.id,
    unit,
    unitPriceCents,
    totalCents: unitPriceCents * line.quantity,
    leadDays: t.leadDays + extraDays,
    breaks: [1, 10, 50, 100].map((qty) => ({
      qty,
      unitPriceCents: convert(applyMargin(unitCost(line, qty).costCents, t.margin), currency, fxRate),
    })),
  };
}

export function priceQuote(lines: Line[], tier: TierKey, depositPct: number, currency: Currency, fxRate: number): QuotePrice {
  const priced = lines.map((l) => priceLine(l, tier, currency, fxRate));
  const subtotalCents = priced.reduce((s, l) => s + l.totalCents, 0);
  return {
    currency,
    tier,
    lines: priced,
    subtotalCents,
    depositCents: Math.round((subtotalCents * depositPct) / 100),
    leadDays: Math.max(0, ...priced.map((l) => l.leadDays)),
  };
}
