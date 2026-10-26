import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getPurchaseOrderForExport } from "@/lib/data/purchase-orders";
import { getRfqQuoteComparison } from "@/lib/data/rfq-quote-comparison";
import { buildPurchaseOrderPdfFilename } from "@/lib/purchase-order-pdf/filename";
import { isPurchaseOrderPdfCategory, PurchaseOrderPdf } from "@/lib/purchase-order-pdf/purchase-order-pdf";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;

// GET /api/purchase-orders/[id]/export - downloads the issued PO using
// the immutable issuance snapshot for quantities and prices.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const [data, issuedOrder] = await Promise.all([getRfqQuoteComparison(id, []), getPurchaseOrderForExport(id)]);
    if (!data) {
      return NextResponse.json({ error: { message: t.downloadPdfNotFound } }, { status: 404 });
    }
    if (!isPurchaseOrderPdfCategory(data.category)) {
      return NextResponse.json({ error: { message: t.downloadPdfUnsupportedCategory } }, { status: 400 });
    }
    if (!issuedOrder) {
      return NextResponse.json({ error: { message: t.downloadPdfNotIssued } }, { status: 409 });
    }
    if (issuedOrder.requisitionId !== id) {
      return NextResponse.json({ error: { message: t.downloadPdfNotFound } }, { status: 404 });
    }

    const vendor = data.vendors[0];
    if (!vendor) {
      return NextResponse.json({ error: { message: t.downloadPdfNotFound } }, { status: 404 });
    }

    const category = data.category;
    const items = issuedOrder.items.map((issuedItem, index) => {
      const quoteItem = vendor.lineItems[index];
      return {
        description: issuedItem.description,
        impaCode: quoteItem?.offeredImpaCode?.trim() || quoteItem?.requestedImpaCode?.trim() || null,
        partNo: issuedItem.partNo,
        quantity: issuedItem.quantity,
        unit: issuedItem.uom,
        unitPrice: issuedItem.unitPrice,
        totalPrice: issuedItem.totalPrice,
        leadTime: quoteItem?.deliveryLeadTime ?? null,
        remarks: quoteItem?.remarks ?? null,
      };
    });

    const logo = await readFile(join(process.cwd(), "public", "mysea-shipping-logo.jpeg"));
    const logoDataUri = `data:image/jpeg;base64,${logo.toString("base64")}`;
    const buffer = await renderToBuffer(
      <PurchaseOrderPdf
        category={category}
        logoDataUri={logoDataUri}
        prNumber={data.prNumber}
        requisitionTitle={data.title}
        vesselName={data.vesselLabel}
        vesselImoNo={data.vesselImoNo}
        vesselMasterOwners={data.vesselMasterOwners}
        issuedAt={issuedOrder.issuedAt}
        issuedVendorName={issuedOrder.vendorName}
        issuedVendorEmail={issuedOrder.vendorEmail}
        invoiceCompanyName={issuedOrder.invoiceCompanyName}
        invoiceAddress={issuedOrder.invoiceAddress}
        vendor={vendor}
        items={items}
      />,
    );
    const filename = buildPurchaseOrderPdfFilename(data.prNumber);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/export:GET]", error);
    return NextResponse.json({ error: { message: t.downloadPdfError } }, { status: 500 });
  }
}
