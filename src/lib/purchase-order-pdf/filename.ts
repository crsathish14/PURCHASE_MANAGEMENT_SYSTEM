import { sanitizeFilenameSegment } from "@/lib/format";

// The PO number is the file name. A PO with no number (issued before numbering
// existed, vessel still without a code) keeps the older PR-based name.
export function buildPurchaseOrderPdfFilename(poNumber: string | null, prNumber: string): string {
  const base = poNumber?.trim() || `${prNumber}-Purchase-Order`;
  return `${sanitizeFilenameSegment(base)}.pdf`;
}

export function buildPurchaseOrderProformaInvoiceFilename(prNumber: string): string {
  return `${sanitizeFilenameSegment(prNumber)}-proforma-invoice.pdf`;
}
