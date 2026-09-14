import { Text, View } from "@react-pdf/renderer";

import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { pdfStyles } from "./styles";

// The PR-context fields every category's PDF template needs, built once in
// the route handler from QuoteComparisonData and passed uniformly to
// whichever category's Document component is selected — Stores' own
// template simply never renders an Equipment Details section with these,
// but keeping the shape identical across all three is what lets the route's
// Record<PrCategory, typeof StoresQuotePdf> dispatch map typecheck cleanly.
export type RfqQuotePdfPrContext = {
  prNumber: string;
  vesselLabel: string | null;
  vesselImoNo: string | null;
  requisitionDate: string | null;
  requiredPort: string | null;
  requiredDate: string | null;
  equipmentName: string | null;
  equipmentType: string | null;
  equipmentMake: string | null;
  equipmentSerialNo: string | null;
  equipmentModel: string | null;
  equipmentSpecifications: string | null;
  equipmentOtherDetails: string | null;
};

type RfqDetailsCopy = {
  title: string;
  vesselName: string;
  imoNo: string;
  dateOfIssue: string;
  requisitionNo: string;
  portOfDelivery: string;
  requiredDate: string;
  requestedCurrency: string;
  quotationNo: string;
  refNo: string;
};

type VendorDetailsCopy = {
  title: string;
  vendorName: string;
  contactPerson: string;
  contactNo: string;
  email: string;
  otherDetails: string;
};

type EquipmentDetailsCopy = {
  title: string;
  nameOfEquipment: string;
  type: string;
  make: string;
  serialNo: string;
  model: string;
  specifications: string;
  otherDetails: string;
};

type QuotationSummaryCopy = {
  title: string;
  totalQuotedAmount: string;
  quotationValidity: string;
  paymentTerms: string;
  deliveryTerms: string;
  remarksNotes: string;
};

// Same "—"-on-empty fallback the on-screen comparison cards already use
// (their own local displayValue()) — dates pass through unformatted here too,
// matching how the cards render requisitionDate/requiredDate as plain
// strings with no Intl.DateTimeFormat reformatting.
export function displayPdfValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

function PdfField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={wide ? pdfStyles.fieldFull : pdfStyles.fieldHalf}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  );
}

export function PdfHeader({ companyName, documentTitle }: { companyName: string; documentTitle: string }) {
  return (
    <View style={pdfStyles.headerBlock}>
      <Text style={pdfStyles.companyName}>{companyName}</Text>
      <Text style={pdfStyles.documentTitle}>{documentTitle}</Text>
    </View>
  );
}

// Field order/grouping mirrors the on-screen comparison cards' own inline
// RFQ Details section exactly (they don't use a shared component for this
// one — it's inlined per card — so this is the PDF's own equivalent, not a
// reuse of existing JSX, which @react-pdf/renderer couldn't render anyway).
export function RfqDetailsSection({
  t,
  pr,
  vendor,
}: {
  t: RfqDetailsCopy;
  pr: RfqQuotePdfPrContext;
  vendor: QuoteComparisonVendor;
}) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{t.title}</Text>
      <View style={pdfStyles.fieldGrid}>
        <PdfField label={t.vesselName} value={displayPdfValue(pr.vesselLabel)} />
        <PdfField label={t.imoNo} value={displayPdfValue(pr.vesselImoNo)} />
        <PdfField label={t.dateOfIssue} value={displayPdfValue(pr.requisitionDate)} />
        <PdfField label={t.requisitionNo} value={pr.prNumber} />
        <PdfField label={t.portOfDelivery} value={displayPdfValue(pr.requiredPort)} />
        <PdfField label={t.requiredDate} value={displayPdfValue(pr.requiredDate)} />
        <PdfField label={t.requestedCurrency} value={VENDOR_QUOTE_CURRENCY} />
        <View style={pdfStyles.fieldHalf} />
        <PdfField label={t.quotationNo} value={displayPdfValue(vendor.quotationNo)} />
        <PdfField label={t.refNo} value={displayPdfValue(vendor.refNo)} />
      </View>
    </View>
  );
}

export function VendorDetailsSection({ t, vendor }: { t: VendorDetailsCopy; vendor: QuoteComparisonVendor }) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{t.title}</Text>
      <View style={pdfStyles.fieldGrid}>
        <PdfField label={t.vendorName} value={vendor.vendorName} />
        <PdfField label={t.contactPerson} value={displayPdfValue(vendor.vendorContactPerson)} />
        <PdfField label={t.contactNo} value={displayPdfValue(vendor.vendorContactNo)} />
        <PdfField label={t.email} value={displayPdfValue(vendor.vendorEmail)} />
        <PdfField label={t.otherDetails} value={displayPdfValue(vendor.vendorOtherDetails)} wide />
      </View>
    </View>
  );
}

// Spares + Service only — Stores has no equipment concept at all, so
// StoresQuotePdf never renders this. Grid layout mirrors the real shipped
// src/components/vendor-quote/equipment-details-section.tsx exactly (name/
// type, make/serialNo, model/blank, specifications full-width, otherDetails
// full-width).
export function EquipmentDetailsSection({ t, pr }: { t: EquipmentDetailsCopy; pr: RfqQuotePdfPrContext }) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{t.title}</Text>
      <View style={pdfStyles.fieldGrid}>
        <PdfField label={t.nameOfEquipment} value={displayPdfValue(pr.equipmentName)} />
        <PdfField label={t.type} value={displayPdfValue(pr.equipmentType)} />
        <PdfField label={t.make} value={displayPdfValue(pr.equipmentMake)} />
        <PdfField label={t.serialNo} value={displayPdfValue(pr.equipmentSerialNo)} />
        <PdfField label={t.model} value={displayPdfValue(pr.equipmentModel)} />
        <View style={pdfStyles.fieldHalf} />
        <PdfField label={t.specifications} value={displayPdfValue(pr.equipmentSpecifications)} wide />
        <PdfField label={t.otherDetails} value={displayPdfValue(pr.equipmentOtherDetails)} wide />
      </View>
    </View>
  );
}

export function QuotationSummarySection({ t, vendor }: { t: QuotationSummaryCopy; vendor: QuoteComparisonVendor }) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{t.title}</Text>
      <View style={pdfStyles.fieldGrid}>
        <PdfField label={t.totalQuotedAmount} value={formatCurrencyUsd(vendor.totalQuotedAmount)} wide />
        <PdfField label={t.quotationValidity} value={vendor.quotationValidity} />
        <PdfField label={t.paymentTerms} value={vendor.paymentTerms} />
        <PdfField label={t.deliveryTerms} value={vendor.deliveryTerms} wide />
        <PdfField label={t.remarksNotes} value={vendor.remarksNotes} wide />
      </View>
    </View>
  );
}

export function GrandTotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={pdfStyles.grandTotalRow}>
      <Text style={pdfStyles.grandTotalLabel}>{label}</Text>
      <Text style={pdfStyles.grandTotalValue}>{formatCurrencyUsd(amount)}</Text>
    </View>
  );
}
