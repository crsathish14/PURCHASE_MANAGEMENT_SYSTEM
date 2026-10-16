// The Purchase Orders list contains awarded quote rows and saved drafts while
// formal PO issuance is pending. Keep its page-level status values centralized
// so the API data and status labels don't depend on string literals.
export const PURCHASE_ORDER_STATUS = {
  PENDING_PO: "pending_po",
} as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];
