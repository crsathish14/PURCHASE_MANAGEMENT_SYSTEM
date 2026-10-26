import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  PURCHASE_ORDER_PROFORMA_MIME_TYPE,
  PURCHASE_ORDER_PROFORMA_PATH_PREFIX,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { buildPurchaseOrderProformaInvoiceFilename } from "@/lib/purchase-order-pdf/filename";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;
const UUID_PDF_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

// The proforma path is private issuance data. Only an active staff user may
// open a submitted invoice.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.proformaViewNotFound } }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const [issuanceResult, requisitionResult] = await Promise.all([
      admin
        .from("purchase_order_issuances")
        .select("proforma_invoice_path")
        .eq("requisition_id", id)
        .not("proforma_received_at", "is", null)
        .maybeSingle(),
      admin.from("purchase_requisitions").select("pr_number").eq("id", id).maybeSingle(),
    ]);

    if (issuanceResult.error) throw issuanceResult.error;
    if (requisitionResult.error) throw requisitionResult.error;
    const path = issuanceResult.data?.proforma_invoice_path;
    const prNumber = requisitionResult.data?.pr_number;
    if (!path || !prNumber) {
      return NextResponse.json({ error: { message: t.proformaViewNotFound } }, { status: 404 });
    }

    const pathAfterPrefix = path.startsWith(`${PURCHASE_ORDER_PROFORMA_PATH_PREFIX}/`)
      ? path.slice(`${PURCHASE_ORDER_PROFORMA_PATH_PREFIX}/`.length)
      : "";
    const pathSegments = pathAfterPrefix.split("/");
    if (pathSegments.length !== 2 || !UUID_PDF_FILENAME_RE.test(pathSegments[1] ?? "")) {
      return NextResponse.json({ error: { message: t.proformaViewNotFound } }, { status: 404 });
    }

    const { data: pdf, error: downloadError } = await admin
      .storage.from(STORAGE_BUCKET.ATTACHMENTS)
      .download(path);

    if (downloadError || !pdf) {
      return NextResponse.json({ error: { message: t.proformaViewNotFound } }, { status: 404 });
    }

    const filename = buildPurchaseOrderProformaInvoiceFilename(prNumber);
    return new NextResponse(new Uint8Array(await pdf.arrayBuffer()), {
      status: 200,
      headers: {
        "Content-Type": PURCHASE_ORDER_PROFORMA_MIME_TYPE,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/proforma:GET]", error);
    return NextResponse.json({ error: { message: t.proformaViewError } }, { status: 500 });
  }
}
