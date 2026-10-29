import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  INVOICE_DOCUMENT_INVOICE_MIME_TYPE,
  PO_INVOICE_DOCUMENT_PATH_PREFIX,
  STORAGE_BUCKET,
  SUPPORTING_DOC_MIME_TYPES,
} from "@/lib/constants/storage";
import { getInvoiceByToken } from "@/lib/data/purchase-order-invoice";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorInvoice;

const ALL_ACCEPTED_TYPES = [INVOICE_DOCUMENT_INVOICE_MIME_TYPE, ...SUPPORTING_DOC_MIME_TYPES] as const;
type AcceptedMimeType = (typeof ALL_ACCEPTED_TYPES)[number];

const signSchema = z.object({
  fileName: z.string().min(1).max(500),
  contentType: z.enum(ALL_ACCEPTED_TYPES as unknown as [AcceptedMimeType, ...AcceptedMimeType[]]),
  documentType: z.enum(["invoice", "supporting"]),
});

function extensionFor(contentType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[contentType] ?? "bin";
}

// Token-only vendor endpoint: validate the invoice capability before minting
// a signed upload URL. Storage has no anon insert policy.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 400 });
  }

  const result = signSchema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? t.uploadError;
    return NextResponse.json({ error: { message: msg } }, { status: 400 });
  }

  const { contentType, documentType } = result.data;

  if (documentType === "invoice" && contentType !== INVOICE_DOCUMENT_INVOICE_MIME_TYPE) {
    return NextResponse.json({ error: { message: t.invoiceTypeError } }, { status: 400 });
  }

  let detail: Awaited<ReturnType<typeof getInvoiceByToken>>;
  try {
    detail = await getInvoiceByToken(token);
  } catch {
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 500 });
  }

  if (!detail) {
    return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
  }

  const ext = extensionFor(contentType);
  const storagePath = `${PO_INVOICE_DOCUMENT_PATH_PREFIX}/${token}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await createAdminClient()
    .storage.from(STORAGE_BUCKET.ATTACHMENTS)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[api/purchase-order/[token]/invoice/sign:POST]", error);
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 500 });
  }

  return NextResponse.json({ data: { storagePath: data.path, token: data.token } });
}
