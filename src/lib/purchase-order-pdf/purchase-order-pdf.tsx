import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import en from "@/locales/en.json";
import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { PrCategory } from "@/lib/constants/purchase-requisition";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { purchaseOrderPdfStyles as styles } from "./styles";

const t = en.purchaseOrderPdf;

export type PurchaseOrderPdfItem = {
  description: string;
  impaCode: string | null;
  partNo: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number;
  leadTime: string | null;
  remarks: string | null;
};

export type PurchaseOrderPdfProps = {
  category: PrCategory;
  logoDataUri: string;
  prNumber: string;
  requisitionTitle: string | null;
  vesselName: string | null;
  vesselImoNo: string | null;
  vesselMasterOwners: string | null;
  issuedAt: string;
  issuedVendorName: string;
  issuedVendorEmail: string;
  invoiceCompanyName: string;
  invoiceAddress: string;
  vendor: Pick<QuoteComparisonVendor, "vendorContactPerson" | "quotationNo" | "refNo" | "paymentTerms">;
  items: PurchaseOrderPdfItem[];
};

export function isPurchaseOrderPdfCategory(category: string | null): category is PrCategory {
  return Object.values(PR_CATEGORY).includes(category as PrCategory);
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function invoiceValue(value: string | null | undefined): string {
  return value?.trim() || t.placeholder;
}

function PdfLogo({ logoDataUri }: { logoDataUri: string }) {
  // @react-pdf/renderer Image has no alt prop; the company name is repeated beside it.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={logoDataUri} style={styles.logo} />;
}

function displayQuantity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDeliveryTime(items: PurchaseOrderPdfItem[]): string {
  const leadTimes = [...new Set(items.map((item) => item.leadTime?.trim()).filter(Boolean))];
  if (leadTimes.length === 0) return "—";
  if (leadTimes.length === 1) return leadTimes[0] ?? "—";
  return "Refer to item lines";
}

function Header({ logoDataUri, issuedAt }: { logoDataUri: string; issuedAt: string }) {
  return (
    <View style={styles.header} fixed>
      <PdfLogo logoDataUri={logoDataUri} />
      <View style={styles.brand}>
        <Text style={styles.companyName}>{en.common.companyName}</Text>
        <Text style={styles.documentTitle}>{t.documentTitle}</Text>
        <Text style={styles.formNumber}>{t.formNumber}</Text>
      </View>
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaLine}>
          <Text style={styles.headerMetaLabel}>{t.poNumber} </Text>
          {t.placeholder}
        </Text>
        <Text style={styles.headerMetaLine}>
          <Text style={styles.headerMetaLabel}>{t.date} </Text>
          {formatDate(issuedAt)}
        </Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>{en.common.companyName}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          t.page.replace("{page}", String(pageNumber)).replace("{total}", String(totalPages))
        }
      />
    </View>
  );
}

function SupplierField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={wide ? styles.supplierFieldWide : styles.supplierField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function MetadataField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={wide ? styles.metadataCellWide : styles.metadataCell}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function InstructionsSection({ title, instructions }: { title: string; instructions: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {instructions.map((instruction, index) => (
        <View key={`${title}-${index}`} style={styles.instructionRow} wrap={false}>
          <Text style={styles.instructionNumber}>{index + 1}.</Text>
          <Text style={styles.instructionText}>{instruction.replace("{companyName}", en.common.companyName)}</Text>
        </View>
      ))}
    </View>
  );
}

function InvoiceToSection({
  masterOwners,
  companyName,
  address,
}: {
  masterOwners: string | null;
  companyName: string;
  address: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.invoiceToTitle}</Text>
      <View style={styles.invoiceToBox}>
        <Text style={styles.invoiceToMasterOwners}>
          {t.masterAndOwnersOf.replace("{masterOwners}", invoiceValue(masterOwners))}
        </Text>
        <Text style={styles.invoiceToLine}>
          <Text style={styles.headerMetaLabel}>{t.invoiceCompanyName}: </Text>
          {invoiceValue(companyName)}
        </Text>
        <Text style={styles.invoiceToLine}>
          <Text style={styles.headerMetaLabel}>{t.invoiceAddress}: </Text>
          {invoiceValue(address)}
        </Text>
      </View>
    </View>
  );
}

const COLUMN_WIDTH_BY_CATEGORY: Record<
  PrCategory,
  {
    slNo: string;
    description: string;
    code: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    lineTotal: string;
    leadTime: string;
    remarks: string;
  }
> = {
  [PR_CATEGORY.STORES]: {
    slNo: "4%",
    description: "24%",
    code: "9%",
    quantity: "6%",
    unit: "7%",
    unitPrice: "10%",
    lineTotal: "11%",
    leadTime: "10%",
    remarks: "19%",
  },
  [PR_CATEGORY.SPARES]: {
    slNo: "4%",
    description: "24%",
    code: "9%",
    quantity: "6%",
    unit: "7%",
    unitPrice: "10%",
    lineTotal: "11%",
    leadTime: "10%",
    remarks: "19%",
  },
  [PR_CATEGORY.SERVICE]: {
    slNo: "4%",
    description: "28%",
    code: "0%",
    quantity: "6%",
    unit: "7%",
    unitPrice: "10%",
    lineTotal: "11%",
    leadTime: "11%",
    remarks: "23%",
  },
};

export function PurchaseOrderPdf({
  category,
  logoDataUri,
  prNumber,
  requisitionTitle,
  vesselName,
  vesselImoNo,
  vesselMasterOwners,
  issuedAt,
  issuedVendorName,
  issuedVendorEmail,
  invoiceCompanyName,
  invoiceAddress,
  vendor,
  items,
}: PurchaseOrderPdfProps) {
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const supplierReference = vendor.refNo?.trim() || vendor.quotationNo?.trim() || null;
  const categoryCopy = t.categories[category];
  const columns = COLUMN_WIDTH_BY_CATEGORY[category];
  const hasCodeColumn = category !== PR_CATEGORY.SERVICE;
  const codeLabel = category === PR_CATEGORY.STORES ? t.columns.impaCode : t.columns.partNo;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header logoDataUri={logoDataUri} issuedAt={issuedAt} />
        <Footer />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.supplierDetails}</Text>
          <View style={styles.supplierGrid}>
            <SupplierField label={t.supplierName} value={displayValue(issuedVendorName)} />
            <SupplierField label={t.picName} value={displayValue(vendor.vendorContactPerson)} />
            <SupplierField label={t.emailAddress} value={displayValue(issuedVendorEmail)} />
            <SupplierField label={t.supplierAddress} value={t.placeholder} wide />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.orderDetails}</Text>
          <View style={styles.metadataGrid}>
            <MetadataField label={t.supplierReference} value={displayValue(supplierReference)} />
            <MetadataField label={t.poDate} value={formatDate(issuedAt)} />
            <MetadataField label={t.totalAmount} value={formatCurrencyUsd(totalAmount)} />
            <MetadataField label={t.vessel} value={displayValue(vesselName)} />
            <MetadataField label={t.imoNumber} value={displayValue(vesselImoNo)} />
            <MetadataField label={t.ourRequestNumber} value={displayValue(prNumber)} />
            <MetadataField label={t.currency} value={VENDOR_QUOTE_CURRENCY} />
            <MetadataField label={t.paymentTerms} value={displayValue(vendor.paymentTerms)} />
            <MetadataField label={t.deliveryTime} value={getDeliveryTime(items)} />
            <MetadataField label={t.poDescription} value={requisitionTitle?.trim() || t.poDescriptionFallback} wide />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{categoryCopy.itemsTitle}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} wrap={false}>
              <Text style={[styles.tableHeaderCell, { width: columns.slNo }]}>{t.columns.slNo}</Text>
              <Text style={[styles.tableHeaderCell, { width: columns.description }]}>{categoryCopy.description}</Text>
              {hasCodeColumn ? (
                <Text style={[styles.tableHeaderCell, { width: columns.code }]}>{codeLabel}</Text>
              ) : null}
              <Text style={[styles.tableHeaderCell, styles.tableCellRight, { width: columns.quantity }]}>
                {t.columns.quantity}
              </Text>
              <Text style={[styles.tableHeaderCell, { width: columns.unit }]}>{t.columns.unit}</Text>
              <Text style={[styles.tableHeaderCell, styles.tableCellRight, { width: columns.unitPrice }]}>
                {t.columns.unitPrice}
              </Text>
              <Text style={[styles.tableHeaderCell, styles.tableCellRight, { width: columns.lineTotal }]}>
                {t.columns.lineTotal}
              </Text>
              <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: columns.leadTime }]}>
                {t.columns.leadTime}
              </Text>
              <Text style={[styles.tableHeaderCell, { width: columns.remarks }]}>{t.columns.remarks}</Text>
            </View>
            {items.map((item, index) => (
              <View key={`${index}-${item.description}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, { width: columns.slNo }]}>{index + 1}</Text>
                <Text style={[styles.tableCell, { width: columns.description }]}>{item.description}</Text>
                {hasCodeColumn ? (
                  <Text style={[styles.tableCell, { width: columns.code }]}>
                    {displayValue(category === PR_CATEGORY.STORES ? item.impaCode : item.partNo)}
                  </Text>
                ) : null}
                <Text style={[styles.tableCell, styles.tableCellRight, { width: columns.quantity }]}>
                  {displayQuantity(item.quantity)}
                </Text>
                <Text style={[styles.tableCell, { width: columns.unit }]}>{displayValue(item.unit)}</Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: columns.unitPrice }]}>
                  {formatCurrencyUsd(item.unitPrice)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: columns.lineTotal }]}>
                  {formatCurrencyUsd(item.totalPrice)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellCenter, { width: columns.leadTime }]}>
                  {displayValue(item.leadTime)}
                </Text>
                <Text style={[styles.tableCell, { width: columns.remarks }]}>{displayValue(item.remarks)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{t.grandTotal}</Text>
            <Text style={styles.grandTotalValue}>{formatCurrencyUsd(totalAmount)}</Text>
          </View>
        </View>
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header logoDataUri={logoDataUri} issuedAt={issuedAt} />
        <Footer />
        <InvoiceToSection
          masterOwners={vesselMasterOwners}
          companyName={invoiceCompanyName}
          address={invoiceAddress}
        />
        <View style={styles.instructionsColumns}>
          <View style={styles.instructionsColumn}>
            <InstructionsSection title={t.invoicingInstructionsTitle} instructions={t.invoicingInstructions} />
          </View>
          <View style={styles.instructionsColumn}>
            <InstructionsSection title={t.otherInstructionsTitle} instructions={t.otherInstructions} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
