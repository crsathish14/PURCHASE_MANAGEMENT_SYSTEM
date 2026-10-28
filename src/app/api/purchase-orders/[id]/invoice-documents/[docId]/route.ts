import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import { getInvoiceDocumentsForRequisition } from "@/lib/data/purchase-order-invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.invoiceLog;

const PDF_MIME = "application/pdf";
// Map lowercase file extension to MIME type for content negotiation.
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// GET — stream a single invoice document. PDF is served inline; other types
// as an attachment (browsers can't preview Word/Excel files inline).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id, docId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(docId).success) {
    return NextResponse.json({ error: { message: t.invoiceDocumentsModal.loadError } }, { status: 400 });
  }

  try {
    const docs = await getInvoiceDocumentsForRequisition(id);
    const doc = docs.find((d) => d.id === docId);
    if (!doc) {
      return NextResponse.json({ error: { message: t.invoiceDocumentsModal.loadError } }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: file, error: downloadError } = await admin.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .download(doc.storagePath);

    if (downloadError || !file) {
      return NextResponse.json({ error: { message: t.invoiceDocumentsModal.loadError } }, { status: 404 });
    }

    const ext = doc.originalFilename.split(".").pop()?.toLowerCase() ?? "";
    const contentType = EXT_MIME[ext] ?? "application/octet-stream";
    const disposition = contentType === PDF_MIME ? "inline" : "attachment";
    const safeFilename = doc.originalFilename.replace(/[^\w.\-]/g, "_");

    return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/invoice-documents/[docId]:GET]", error);
    return NextResponse.json({ error: { message: t.invoiceDocumentsModal.loadError } }, { status: 500 });
  }
}
