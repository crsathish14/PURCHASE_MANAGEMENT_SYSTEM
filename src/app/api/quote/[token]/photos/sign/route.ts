import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  PHOTO_EXTENSION_BY_MIME_TYPE,
  RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { getRfqQuoteDetailsByToken } from "@/lib/data/rfq-quote";
import { createAdminClient } from "@/lib/supabase/admin";

const t = en.vendorQuote;

const signRequestSchema = z.object({
  lineItemId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_PHOTO_MIME_TYPES, { error: "Unsupported file type." }),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_SIZE_BYTES, { error: "File is too large." }),
});

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor
// with no session, same as api/quote/[token]/submit/route.ts. There is no
// `anon` Storage RLS policy on the attachments bucket (by design — RLS can't
// cross-reference this token against purchase_requisition_rfq_links), so
// authorization instead happens entirely here: re-validate the token and the
// target line item before ever minting a signed URL, then sign with the
// admin/service-role client — the write-side mirror of getRfqQuoteDetailsByToken's
// own read-side "session-scoped client genuinely can't do the job" signing.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const result = signRequestSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: { message: firstIssue?.message ?? "Invalid upload request." } },
      { status: 400 },
    );
  }

  const { lineItemId, contentType } = result.data;

  const detail = await getRfqQuoteDetailsByToken(token);
  if (!detail || detail.isExpired || detail.submittedAt) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }
  if (!detail.lineItems.some((item) => item.lineItemId === lineItemId)) {
    return NextResponse.json({ error: { message: "Invalid upload request." } }, { status: 400 });
  }

  // Server-validated components only — the client's own fileName is never
  // interpolated into the path (kept just as display metadata, see
  // purchase_requisition_rfq_quotation_item_photos.file_name). The access
  // token itself is the scope segment: no separate draft token is needed
  // since it already uniquely and securely identifies this in-progress
  // submission (mirrors uploads/sign's scopeId, just token-shaped here).
  const extension = PHOTO_EXTENSION_BY_MIME_TYPE[contentType];
  const storagePath =
    `${RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX}/${token}/${lineItemId}/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await createAdminClient()
    .storage.from(STORAGE_BUCKET.ATTACHMENTS)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[api/quote/[token]/photos/sign:POST]", error);
    return NextResponse.json(
      { error: { message: "Couldn't prepare this upload. Try again." } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: { storagePath: data.path, token: data.token },
  });
}
