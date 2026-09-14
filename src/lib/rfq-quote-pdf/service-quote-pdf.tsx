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

// Read-only PDF equivalent of service-quote-comparison-card.tsx's exact
// section structure and column set. No Qty/UOM/IMPA concept at all — don't
// force Stores/Spares fields onto Service. Photo columns (office reference
// photos and vendor-uploaded photos) are omitted entirely, per the export
// feature's "no images" requirement.
const t = en.vendorQuote.serviceForm;

const COLUMN_WIDTH = {
  slNo: "5%",
  description: "35%",
  estimatedDuration: "13%",
  sparesConsumablesIncluded: "15%",
  unitPrice: "11%",
  totalPrice: "11%",
  remarks: "10%",
} as const;

export type ServiceQuotePdfProps = {
  vendor: QuoteComparisonVendor;
  pr: RfqQuotePdfPrContext;
};

export function ServiceQuotePdf({ vendor, pr }: ServiceQuotePdfProps) {
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
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.description }]}>
                {t.itemDetails.columns.description}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.estimatedDuration }]}>
                {t.itemDetails.columns.estimatedDuration}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.sparesConsumablesIncluded }]}>
                {t.itemDetails.columns.sparesConsumablesIncluded}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.unitPrice }]}>
                {t.itemDetails.columns.unitPrice}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.totalPrice }]}>
                {t.itemDetails.columns.totalPrice}
              </Text>
              <Text style={[pdfStyles.tableHeaderCell, { width: COLUMN_WIDTH.remarks }]}>{t.itemDetails.columns.remarks}</Text>
            </View>

            {vendor.lineItems.map((item, index) => (
              <View key={item.lineItemId} style={pdfStyles.tableRow} wrap={false}>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.slNo }]}>{index + 1}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.description }]}>{item.requestedDescription}</Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.estimatedDuration }]}>
                  {displayPdfValue(item.estimatedDuration)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: COLUMN_WIDTH.sparesConsumablesIncluded }]}>
                  {displayPdfValue(item.sparesConsumablesIncluded)}
                </Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.unitPrice }]}>
                  {formatCurrencyUsd(item.unitPrice)}
                </Text>
                <Text style={[pdfStyles.tableCell, pdfStyles.tableCellRight, { width: COLUMN_WIDTH.totalPrice }]}>
                  {formatCurrencyUsd(item.totalPrice)}
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
