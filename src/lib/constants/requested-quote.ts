// Derived, page-local status for the Requested Quote list — computed in SQL
// (see the pr_rfq_progress view and search_requested_quotes) mostly from
// received-vs-total quote counts. AWARDED is the one exception: it's read
// straight from purchase_requisitions.status (via search_requested_quotes'
// own override — see that migration), because once a requisition is
// awarded the vendor/quote-count-derived value below it is no longer the
// interesting fact about this row. Values are deliberately distinct from
// every PR_STATUS label (e.g. RFQ_ISSUED's "rfq_issued_status" here vs.
// PR_STATUS.RFQ_ISSUED's "rfq_issued", AWARDED's "awarded_status" here vs.
// PR_STATUS.AWARDED's "awarded") since this is a different concept that
// happens to share some names — never compare one against the other.
export const REQUESTED_QUOTE_STATUS = {
  RFQ_ISSUED: "rfq_issued_status",
  PARTIAL_RECEIVED: "partial_received",
  ALL_RECEIVED: "all_received",
  AWARDED: "awarded_status",
} as const;

export type RequestedQuoteStatus = (typeof REQUESTED_QUOTE_STATUS)[keyof typeof REQUESTED_QUOTE_STATUS];
