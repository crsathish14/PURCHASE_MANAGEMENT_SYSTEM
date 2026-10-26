import { sanitizeFilenameSegment } from "@/lib/format";

export function buildPurchaseOrderPdfFilename(prNumber: string): string {
  return `${sanitizeFilenameSegment(prNumber)}-Purchase-Order.pdf`;
}

export function buildPurchaseOrderProformaInvoiceFilename(prNumber: string): string {
  return `${sanitizeFilenameSegment(prNumber)}-proforma-invoice.pdf`;
}
