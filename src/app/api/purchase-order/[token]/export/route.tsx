import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getPurchaseOrderPdfByToken } from "@/lib/data/purchase-orders";
import { buildPurchaseOrderPdfFilename } from "@/lib/purchase-order-pdf/filename";
import { isPurchaseOrderPdfCategory, PurchaseOrderPdf } from "@/lib/purchase-order-pdf/purchase-order-pdf";

const t = en.vendorPurchaseOrder;

// The permanent vendor token authorizes this read-only PO download.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const detail = await getPurchaseOrderPdfByToken(token);
    if (!detail) {
      return NextResponse.json({ error: { message: t.linkExpired } }, { status: 404 });
    }
    if (!isPurchaseOrderPdfCategory(detail.category)) {
      return NextResponse.json({ error: { message: t.downloadPdfError } }, { status: 400 });
    }

    const logo = await readFile(join(process.cwd(), "public", "mysea-shipping-logo.jpeg"));
    const logoDataUri = `data:image/jpeg;base64,${logo.toString("base64")}`;
    const buffer = await renderToBuffer(
      <PurchaseOrderPdf
        category={detail.category}
        logoDataUri={logoDataUri}
        prNumber={detail.prNumber}
        requisitionTitle={detail.requisitionTitle}
        vesselName={detail.vesselName}
        vesselImoNo={detail.vesselImoNo}
        vesselMasterOwners={detail.vesselMasterOwners}
        issuedAt={detail.issuedAt}
        issuedVendorName={detail.issuedVendorName}
        issuedVendorEmail={detail.issuedVendorEmail}
        invoiceCompanyName={detail.invoiceCompanyName}
        invoiceAddress={detail.invoiceAddress}
        vendor={{
          vendorContactPerson: detail.vendorContactPerson,
          quotationNo: detail.quotationNo,
          refNo: detail.refNo,
          paymentTerms: detail.paymentTerms,
        }}
        items={detail.items}
      />,
    );
    const filename = buildPurchaseOrderPdfFilename(detail.prNumber);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/purchase-order/[token]/export:GET]", error);
    return NextResponse.json({ error: { message: t.downloadPdfError } }, { status: 500 });
  }
}
