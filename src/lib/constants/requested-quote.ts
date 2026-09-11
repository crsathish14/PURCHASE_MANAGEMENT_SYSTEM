// Derived, page-local status for the Requested Quote list — computed in SQL
// (see the pr_rfq_progress view) from received-vs-total quote counts, NEVER
// read from purchase_requisitions.status (that column alone can't
// distinguish "1 of 3 vendors responded" from "3 of 3", both read as
// `quotes_received`). Values are deliberately distinct from every PR_STATUS
// label (e.g. RFQ_ISSUED's "rfq_issued_status" here vs. PR_STATUS.RFQ_ISSUED's
// "rfq_issued") since this is a different concept that happens to share a
// name — never compare one against the other.
export const REQUESTED_QUOTE_STATUS = {
  RFQ_ISSUED: "rfq_issued_status",
  PARTIAL_RECEIVED: "partial_received",
  ALL_RECEIVED: "all_received",
} as const;

export type RequestedQuoteStatus = (typeof REQUESTED_QUOTE_STATUS)[keyof typeof REQUESTED_QUOTE_STATUS];
