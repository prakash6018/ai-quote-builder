import { CURRENCIES, type Currency } from "./catalog.ts";

export function money(cents: number, currency: Currency): string {
  const c = CURRENCIES[currency];
  return new Intl.NumberFormat(c.locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
