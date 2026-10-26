import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES,
  PURCHASE_ORDER_PROFORMA_MIME_TYPE,
  PURCHASE_ORDER_PROFORMA_PATH_PREFIX,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { getPurchaseOrderByToken } from "@/lib/data/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorPurchaseOrder;
const signRequestSchema = z.object({
  fileName: z.string().min(1).max(255).refine((name) => name.toLowerCase().endsWith(".pdf")),
  contentType: z.literal(PURCHASE_ORDER_PROFORMA_MIME_TYPE),
  sizeBytes: z.number().int().positive().max(MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES),
});

// Token-only vendor endpoint: validate the PO capability here before minting
// a signed URL with the service-role client. Storage has no anon insert policy.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 400 });
  }

  const result = signRequestSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json({ error: { message: firstIssue?.message ?? t.pdfOnlyError } }, { status: 400 });
  }

  const detail = await getPurchaseOrderByToken(token);
  if (!detail) {
    return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
  }

  const storagePath = `${PURCHASE_ORDER_PROFORMA_PATH_PREFIX}/${token}/${crypto.randomUUID()}.pdf`;
  const { data, error } = await createAdminClient()
    .storage.from(STORAGE_BUCKET.ATTACHMENTS)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[api/purchase-order/[token]/proforma/sign:POST]", error);
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 500 });
  }

  return NextResponse.json({ data: { storagePath: data.path, token: data.token } });
}
