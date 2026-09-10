import { defaultLocale } from "@/lib/i18n";

// Single source of truth for locale-prefixed paths — never hardcode "/en/..."
// directly, import from here so a future locale change or typo is caught
// everywhere at once instead of drifting file by file.
export const ROUTES = {
  LOGIN: `/${defaultLocale}/login`,
  REQUEST_ACCESS: `/${defaultLocale}/request-access`,
  CHANGE_PASSWORD: `/${defaultLocale}/change-password`,
  DASHBOARD: `/${defaultLocale}/dashboard`,
  TEAM_ACCESS: `/${defaultLocale}/team-access`,
  PIPELINE: `/${defaultLocale}/pipeline`,
  PO_REQUESTS: `/${defaultLocale}/po-requests`,
  RFQ_LIST: `/${defaultLocale}/rfq-list`,
  PURCHASE_ORDERS: `/${defaultLocale}/purchase-orders`,
  INVOICE_LOG: `/${defaultLocale}/invoice-log`,
  DELIVERY_NOTES: `/${defaultLocale}/delivery-notes`,
  VENDORS: `/${defaultLocale}/vendors`,
  VESSELS: `/${defaultLocale}/vessels`,
  REPORTS: `/${defaultLocale}/reports`,
  QUOTE_FORM: `/${defaultLocale}/quote`,
} as const;

// This app's first dynamic-segment path — every other ROUTES entry above is
// a flat static string, but a per-token vendor link can't be one of those.
// Still built from ROUTES.QUOTE_FORM (never a second hardcoded "/en/quote"
// literal), so this helper, src/proxy.ts's public-path prefix check, and
// src/app/[lang]/quote/[token]/page.tsx's own segment all stay derived from
// the same single source instead of three independently-typed strings.
export function quoteFormPath(token: string): string {
  return `${ROUTES.QUOTE_FORM}/${token}`;
}
