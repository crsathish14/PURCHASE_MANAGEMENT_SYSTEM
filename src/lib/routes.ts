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
} as const;
