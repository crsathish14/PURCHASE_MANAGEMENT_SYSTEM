import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { PURCHASE_ORDER_PROFORMA_PATH_PREFIX, STORAGE_BUCKET } from "@/lib/constants/storage";
import { getPurchaseOrderByToken } from "@/lib/data/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorPurchaseOrder;
const deleteRequestSchema = z.object({ storagePath: z.string().min(1).max(500) });
const UUID_PDF_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

// Anonymous vendors may remove only a PDF in their own active PO token folder.
export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const detail = await getPurchaseOrderByToken(token);
  if (!detail) {
    return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.deleteError } }, { status: 400 });
  }

  const result = deleteRequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { message: t.deleteError } }, { status: 400 });
  }

  const expectedPrefix = `${PURCHASE_ORDER_PROFORMA_PATH_PREFIX}/${token}/`;
  const pathFileName = result.data.storagePath.startsWith(expectedPrefix)
    ? result.data.storagePath.slice(expectedPrefix.length)
    : "";
  if (!UUID_PDF_FILENAME_RE.test(pathFileName)) {
    return NextResponse.json({ error: { message: t.deleteError } }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .storage.from(STORAGE_BUCKET.ATTACHMENTS)
    .remove([result.data.storagePath]);

  if (error) {
    console.error("[api/purchase-order/[token]/proforma/upload:DELETE]", error);
    return NextResponse.json({ error: { message: t.deleteError } }, { status: 500 });
  }

  return NextResponse.json({ data: { success: true } });
}
