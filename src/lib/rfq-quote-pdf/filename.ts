import { sanitizeFilenameSegment } from "@/lib/format";

// Shared by the export route (Content-Disposition header) and the RFQ Vendor
// modal's own fallback filename, so the two ends can't drift apart the way
// the Excel export's two independently-hand-typed filename templates
// technically could.
export function buildRfqQuotePdfFilename(prNumber: string, vendorName: string): string {
  return `RFQ-${sanitizeFilenameSegment(prNumber)}-${sanitizeFilenameSegment(vendorName)}-Quote.pdf`;
}
