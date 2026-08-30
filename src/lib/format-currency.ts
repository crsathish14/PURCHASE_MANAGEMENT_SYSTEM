import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: VENDOR_QUOTE_CURRENCY,
});

// Vendor RFQ quoting is USD-only in this version (see
// src/lib/constants/vendor-quote.ts) — no other currency formatting exists
// anywhere in the app yet, so this stays deliberately single-purpose rather
// than accepting a currency argument nothing currently passes.
export function formatCurrencyUsd(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) return "—";
  return formatter.format(amount);
}
