import { Document, Page, Text, View } from "@react-pdf/renderer";

import en from "@/locales/en.json";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import {
  displayPdfValue,
  EquipmentDetailsSection,
  GrandTotalRow,
  PdfHeader,
  QuotationSummarySection,
  RfqDetailsSection,
  VendorDetailsSection,
  type RfqQuotePdfPrContext,
} from "./sections";
import { pdfStyles } from "./styles";

// Read-only PDF equivalent of spares-quote-comparison-card.tsx's exact
// section structure and column set. Photo columns (office reference photos
// and vendor-uploaded photos) are omitted entirely, per the export feature's
// "no images" requirement.
const t = en.vendorQuote.sparesForm;

const COLUMN_WIDTH = {
  slNo: "4%",
  requestedDescription: "13%",
  requestedPartNo: "9%",
  offeredDescription: "13%",
  offeredPartNo: "9%",
  itemType: "8%",
  qty: "4%",
  uom: "5%",
  unitPrice: "8%",
  totalPrice: "8%",
  deliveryLeadTime: "9%",
  remarks: "10%",
} as const;

export type SparesQuotePdfProps = {
  vendor: QuoteComparisonVendor;
  pr: RfqQuotePdfPrContext;
};

export function SparesQuotePdf({ vendor, pr }: SparesQuotePdfProps) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader companyName={t.pdfHeader.companyName} documentTitle={t.pdfHeader.documentTitle} />
        <RfqDetailsSection t={t.rfqDetails} pr={pr} vendor={vendor} />
        <VendorDetailsSection t={t.vendorDetails} vendor={vendor} />
        <EquipmentDetailsSection t={t.equipmentDetails} pr={pr} />

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{t.itemDetails.title}</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow} wrap={false}>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.slNo }]}>{t.itemDetails.columns.slNo}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.requestedDescription }]}>
                {t.itemDetails.columns.requestedDescription}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.requestedPartNo }]}>
                {t.itemDetails.columns.partNo}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.offeredDescription }]}>
                {t.itemDetails.columns.offeredDescription}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.offeredPartNo }]}>
                {t.itemDetails.columns.offeredPartNo}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.itemType }]}>{t.itemDetails.columns.itemType}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.qty }]}>{t.itemDetails.columns.qty}</Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.uom }]}>{t.itemDetails.columns.uom}</Text>
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
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.requestedPartNo }]}>
                  {displayPdfValue(item.requestedPartNo)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.offeredDescription }]}>
                  {displayPdfValue(item.offeredDescription)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.offeredPartNo }]}>
                  {displayPdfValue(item.offeredPartNo)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.itemType }]}>{displayPdfValue(item.itemType)}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.qty }]}>{displayPdfValue(item.approvedQty)}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.uom }]}>{displayPdfValue(item.uom)}</Text>
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
