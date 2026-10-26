// Keep Purchase Orders list status values centralized so API data and status
// labels don't depend on string literals.
export const PURCHASE_ORDER_STATUS = {
  PENDING_PO: "pending_po",
  PO_ISSUED: "po_issued",
  PROFORMA_RECEIVED: "proforma_received",
} as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];
