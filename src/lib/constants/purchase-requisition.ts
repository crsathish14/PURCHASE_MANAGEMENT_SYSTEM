// Single source of truth for purchase_requisitions.priority/status values —
// never compare against the raw "high"/"pending_rfq"/etc. string literals
// directly, import these instead so a typo is a type error, not a silent no-op.
export const PR_PRIORITY = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;
export const PR_STATUS = {
  PENDING_RFQ: "pending_rfq",
  RFQ_ISSUED: "rfq_issued",
  QUOTES_RECEIVED: "quotes_received",
  AWARDED: "awarded",
  CANCELLED: "cancelled",
} as const;

export type PrPriority = (typeof PR_PRIORITY)[keyof typeof PR_PRIORITY];
export type PrStatus = (typeof PR_STATUS)[keyof typeof PR_STATUS];
