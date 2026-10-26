import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES,
  PURCHASE_ORDER_PROFORMA_PATH_PREFIX,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { getPurchaseOrderByToken } from "@/lib/data/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorPurchaseOrder;
const submitRequestSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255).refine((name) => !/[\\/\u0000-\u001f\u007f]/.test(name)),
});
const UUID_PDF_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

// Anonymous vendors can submit only an upload path in their own token-scoped
// folder. The database RPC atomically records one file and makes the token
// unavailable to future lookups.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const detail = await getPurchaseOrderByToken(token);
  if (!detail) {
    return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.submitError } }, { status: 400 });
  }

  const result = submitRequestSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json({ error: { message: firstIssue?.message ?? t.submitError } }, { status: 400 });
  }

  const { storagePath, fileName } = result.data;
  const expectedPrefix = `${PURCHASE_ORDER_PROFORMA_PATH_PREFIX}/${token}/`;
  const pathFileName = storagePath.startsWith(expectedPrefix) ? storagePath.slice(expectedPrefix.length) : "";
  if (!UUID_PDF_FILENAME_RE.test(pathFileName) || !fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: { message: t.pdfOnlyError } }, { status: 400 });
  }

  try {
    const { data: pdf, error: downloadError } = await createAdminClient()
      .storage.from(STORAGE_BUCKET.ATTACHMENTS)
      .download(storagePath);

    if (downloadError || !pdf) {
      return NextResponse.json({ error: { message: t.uploadRequired } }, { status: 400 });
    }
    if (pdf.size === 0 || pdf.size > MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES) {
      return NextResponse.json({ error: { message: t.pdfSizeError } }, { status: 400 });
    }

    const header = await pdf.slice(0, 1024).text();
    if (!header.includes("%PDF-")) {
      return NextResponse.json({ error: { message: t.invalidPdfError } }, { status: 400 });
    }

    const { data: submitted, error } = await createAdminClient().rpc("submit_purchase_order_proforma", {
      p_token: token,
      p_storage_path: storagePath,
      p_file_name: fileName,
    });

    if (error) {
      console.error("[api/purchase-order/[token]/proforma/submit:POST]", error);
      return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
    }
    if (!submitted) {
      return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[api/purchase-order/[token]/proforma/submit:POST]", error);
    return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
  }
}
