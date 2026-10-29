import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { PO_INVOICE_DOCUMENT_PATH_PREFIX, STORAGE_BUCKET } from "@/lib/constants/storage";
import { getInvoiceByToken } from "@/lib/data/purchase-order-invoice";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorInvoice;

const supportingDocSchema = z.object({
  storagePath: z.string().min(1).max(500),
  originalFilename: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((n) => !/[\\/\u0000-\u001f\u007f]/.test(n)),
});

const submitSchema = z.object({
  invoicePath: z.string().min(1).max(500),
  invoiceFilename: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((n) => !/[\\/\u0000-\u001f\u007f]/.test(n)),
  supportingDocs: z.array(supportingDocSchema).max(5).default([]),
});

function validTokenPath(token: string, path: string): boolean {
  return path.startsWith(`${PO_INVOICE_DOCUMENT_PATH_PREFIX}/${token}/`);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let detail: Awaited<ReturnType<typeof getInvoiceByToken>>;
  try {
    detail = await getInvoiceByToken(token);
  } catch {
    return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
  }

  if (!detail) {
    return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.submitError } }, { status: 400 });
  }

  const result = submitSchema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? t.submitError;
    return NextResponse.json({ error: { message: msg } }, { status: 400 });
  }

  const { invoicePath, invoiceFilename, supportingDocs } = result.data;

  if (!validTokenPath(token, invoicePath)) {
    return NextResponse.json({ error: { message: t.submitError } }, { status: 400 });
  }

  for (const doc of supportingDocs) {
    if (!validTokenPath(token, doc.storagePath)) {
      return NextResponse.json({ error: { message: t.submitError } }, { status: 400 });
    }
  }

  // Verify the invoice actually exists in Storage and is a real PDF.
  try {
    const admin = createAdminClient();
    const { data: invoiceFile, error: dlErr } = await admin.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .download(invoicePath);

    if (dlErr || !invoiceFile) {
      return NextResponse.json({ error: { message: t.invoiceRequired } }, { status: 400 });
    }

    if (invoiceFile.size === 0) {
      return NextResponse.json({ error: { message: t.invoiceRequired } }, { status: 400 });
    }

    const header = await invoiceFile.slice(0, 1024).text();
    if (!header.includes("%PDF-")) {
      return NextResponse.json({ error: { message: t.invoiceTypeError } }, { status: 400 });
    }

    const { data: submitted, error: rpcError } = await admin.rpc("submit_purchase_order_invoice", {
      p_token: token,
      p_invoice_path: invoicePath,
      p_invoice_name: invoiceFilename,
      p_supporting_docs: supportingDocs.map((d) => ({
        storage_path: d.storagePath,
        original_filename: d.originalFilename,
      })),
    });

    if (rpcError) {
      if (rpcError.code === "23514") {
        return NextResponse.json({ error: { message: rpcError.message } }, { status: 400 });
      }
      console.error("[api/purchase-order/[token]/invoice/submit:POST]", rpcError);
      return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
    }

    if (!submitted) {
      return NextResponse.json({ error: { message: t.linkExpired } }, { status: 409 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[api/purchase-order/[token]/invoice/submit:POST]", error);
    return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
  }
}
