// Shop rates and materials. Illustrative numbers for a fictional job shop;
// a real deployment loads these from the estimating team's rate card.

export const MATERIALS = {
  "al-6061": { label: "Aluminium 6061-T6", densityGcm3: 2.7, usdPerKg: 7.5, machinability: 1.0 },
  "al-5052": { label: "Aluminium 5052-H32", densityGcm3: 2.68, usdPerKg: 6.8, machinability: 1.05 },
  "ss-304": { label: "Stainless steel 304", densityGcm3: 8.0, usdPerKg: 6.2, machinability: 1.9 },
  "ms-1018": { label: "Mild steel 1018", densityGcm3: 7.87, usdPerKg: 2.4, machinability: 1.4 },
  "brass-360": { label: "Brass C360", densityGcm3: 8.5, usdPerKg: 11.0, machinability: 0.8 },
  "pom": { label: "Acetal (POM)", densityGcm3: 1.41, usdPerKg: 9.0, machinability: 0.7 },
} as const;

export type MaterialKey = keyof typeof MATERIALS;

export const PROCESSES = {
  cnc: { label: "CNC machining", machineUsdPerHour: 85, setupUsd: 120 },
  sheet: { label: "Sheet metal", machineUsdPerHour: 60, setupUsd: 60 },
} as const;

export type ProcessKey = keyof typeof PROCESSES;

export const FINISHES = {
  none: { label: "As machined", usdPerCm2: 0, minUsd: 0 },
  anodize: { label: "Anodize (clear)", usdPerCm2: 0.004, minUsd: 4 },
  powder: { label: "Powder coat", usdPerCm2: 0.006, minUsd: 6 },
  passivate: { label: "Passivate", usdPerCm2: 0.002, minUsd: 3 },
  zinc: { label: "Zinc plate", usdPerCm2: 0.003, minUsd: 3.5 },
} as const;

export type FinishKey = keyof typeof FINISHES;

export const TOLERANCES = {
  standard: { label: "±0.1 mm", factor: 1.0 },
  precision: { label: "±0.05 mm", factor: 1.35 },
  tight: { label: "±0.01 mm", factor: 1.8 },
} as const;

export type ToleranceKey = keyof typeof TOLERANCES;

/** Margin tiers: what the customer chooses between. */
export const TIERS = {
  standard: { label: "Standard", margin: 0.3, leadDays: 10 },
  expedited: { label: "Expedited", margin: 0.42, leadDays: 5 },
  priority: { label: "Priority", margin: 0.55, leadDays: 3 },
} as const;

export type TierKey = keyof typeof TIERS;

/** Run-time discount as batch size grows (setup is amortised separately). */
export const QUANTITY_BREAKS = [
  { minQty: 1, runDiscount: 0 },
  { minQty: 10, runDiscount: 0.08 },
  { minQty: 50, runDiscount: 0.15 },
  { minQty: 100, runDiscount: 0.2 },
] as const;

export const CURRENCIES = {
  USD: { symbol: "$", locale: "en-US" },
  INR: { symbol: "₹", locale: "en-IN" },
} as const;

export type Currency = keyof typeof CURRENCIES;
