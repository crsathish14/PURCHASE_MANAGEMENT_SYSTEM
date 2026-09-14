import { Document, Page, Text, View } from "@react-pdf/renderer";

import en from "@/locales/en.json";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import {
  displayPdfValue,
  GrandTotalRow,
  PdfHeader,
  QuotationSummarySection,
  RfqDetailsSection,
  VendorDetailsSection,
  type RfqQuotePdfPrContext,
} from "./sections";
import { pdfStyles } from "./styles";

// Read-only PDF equivalent of stores-quote-comparison-card.tsx's exact
// section structure and column set (RFQ Details -> Vendor Details -> Item
// Details -> Grand Total -> Quotation Summary & Terms, no Equipment Details
// section — Stores has no equipment concept). Photo columns (office
// reference photos and vendor-uploaded photos) are omitted entirely, per the
// export feature's "no images" requirement.
const t = en.vendorQuote.storesForm;

const COLUMN_WIDTH = {
  slNo: "4%",
  requestedDescription: "16%",
  impaCode: "8%",
  approvedQty: "5%",
  uom: "6%",
  offeredDescription: "16%",
  offeredImpaCode: "8%",
  unitPrice: "9%",
  totalPrice: "9%",
  deliveryLeadTime: "8%",
  remarks: "11%",
} as const;

export type StoresQuotePdfProps = {
  vendor: QuoteComparisonVendor;
  pr: RfqQuotePdfPrContext;
};

export function StoresQuotePdf({ vendor, pr }: StoresQuotePdfProps) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader companyName={t.pdfHeader.companyName} documentTitle={t.pdfHeader.documentTitle} />
        <RfqDetailsSection t={t.rfqDetails} pr={pr} vendor={vendor} />
        <VendorDetailsSection t={t.vendorDetails} vendor={vendor} />

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{t.itemDetails.title}</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow} wrap={false}>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.slNo }]}>{t.itemDetails.columns.slNo}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.requestedDescription }]}>
                {t.itemDetails.columns.requestedDescription}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.impaCode }]}>{t.itemDetails.columns.impaCode}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.approvedQty }]}>
                {t.itemDetails.columns.approvedQty}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.uom }]}>{t.itemDetails.columns.uom}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.offeredDescription }]}>
                {t.itemDetails.columns.offeredDescription}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.offeredImpaCode }]}>
                {t.itemDetails.columns.offeredImpaCode}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.unitPrice }]}>
                {t.itemDetails.columns.unitPrice}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.totalPrice }]}>
                {t.itemDetails.columns.totalPrice}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.deliveryLeadTime }]}>
                {t.itemDetails.columns.deliveryLeadTime}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.remarks }]}>{t.itemDetails.columns.remarks}</Text>
            </View>

            {vendor.lineItems.map((item, index) => (
              <View key={item.lineItemId} style={pdfStyles.tableRow} wrap={false}>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.slNo }]}>{index + 1}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.requestedDescription }]}>
                  {item.requestedDescription}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.impaCode }]}>
                  {displayPdfValue(item.requestedImpaCode)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.approvedQty }]}>
                  {displayPdfValue(item.approvedQty)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.uom }]}>{displayPdfValue(item.uom)}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.offeredDescription }]}>
                  {displayPdfValue(item.offeredDescription)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.offeredImpaCode }]}>
                  {displayPdfValue(item.offeredImpaCode)}
                </Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.unitPrice }]}>
                  {formatCurrencyUsd(item.unitPrice)}
                </Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.totalPrice }]}>
                  {formatCurrencyUsd(item.totalPrice)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.deliveryLeadTime }]}>
                  {displayPdfValue(item.deliveryLeadTime)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.remarks }]}>{displayPdfValue(item.remarks)}</Text>
              </View>
            ))}
          </View>
          <GrandTotalRow label={t.itemDetails.grandTotal} amount={vendor.totalQuotedAmount} />
        </View>

        <QuotationSummarySection t={t.quotationSummary} vendor={vendor} />
      </Page>
    </Document>
  );
}
