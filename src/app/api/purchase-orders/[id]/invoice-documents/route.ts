import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  SIGNED_DISPLAY_URL_TTL_SECONDS,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { getInvoiceDocumentsForRequisition } from "@/lib/data/purchase-order-invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.invoiceLog;

// GET — return all documents for a submitted invoice with short-lived signed
// view URLs. Staff only; uses admin client to sign (bucket is private).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.invoiceDocumentsModal.loadError } }, { status: 400 });
  }

  try {
    const docs = await getInvoiceDocumentsForRequisition(id);
    if (docs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const admin = createAdminClient();
    const paths = docs.map((d) => d.storagePath);
    const { data: signed, error: signError } = await admin.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUrls(paths, SIGNED_DISPLAY_URL_TTL_SECONDS);

    if (signError) {
      console.error("[api/purchase-orders/[id]/invoice-documents:GET]", signError);
      return NextResponse.json(
        { error: { message: t.invoiceDocumentsModal.loadError } },
        { status: 500 },
      );
    }

    const signedMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

    return NextResponse.json({
      data: docs.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        originalFilename: d.originalFilename,
        sortOrder: d.sortOrder,
        signedUrl: signedMap.get(d.storagePath) ?? null,
        storagePath: d.storagePath,
      })),
    });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/invoice-documents:GET]", error);
    return NextResponse.json(
      { error: { message: t.invoiceDocumentsModal.loadError } },
      { status: 500 },
    );
  }
}
