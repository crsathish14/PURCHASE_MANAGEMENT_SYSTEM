// Per-vendor-link status for the RFQ vendor management dialog — derived
// (never a stored column) from a purchase_requisition_rfq_links row's
// submitted_at/expires_at. Deliberately a separate concept/file from
// REQUESTED_QUOTE_STATUS (src/lib/constants/requested-quote.ts): that one is
// a per-PR aggregate (RFQ Issued/Partial/All Received across every vendor),
// this one is per-vendor-link — keeping them distinctly named avoids ever
// confusing the two 3-state enums.
export const RFQ_LINK_STATUS = {
  PENDING: "pending",
  QUOTE_RECEIVED: "quote_received",
  EXPIRED: "expired",
} as const;

export type RfqLinkStatus = (typeof RFQ_LINK_STATUS)[keyof typeof RFQ_LINK_STATUS];

// Compare Quotes cap — shared between rfq-links-dialog.tsx's checkbox
// selection and the compare API route's own server-side clamp (defense in
// depth: the client already prevents selecting more, but the route doesn't
// trust that alone).
export const MAX_COMPARE_SELECTION = 3;
