import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  PHOTO_EXTENSION_BY_MIME_TYPE,
  PR_LINE_ITEM_PHOTO_PATH_PREFIX,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

// Matches both a crypto.randomUUID() create-mode draft token / a real
// purchase_requisitions.id (scopeId) and react-hook-form's useFieldArray
// field.id (lineItemFieldId) — both always UUID-shaped. Not a security
// boundary by itself; it's what keeps a signed path confined to the expected
// folder-prefix shape server-side (see storagePath construction below) — the
// actual authorization is requireApiActiveUser() plus the storage.objects RLS
// policies from 20260823190000_storage_attachments_policies.sql.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const signRequestSchema = z.object({
  // A discriminant even though only one value exists today — a second upload
  // feature (see plans/development.md §11) adds a new literal + branch here
  // instead of a new route.
  scope: z.literal("pr-line-item-photo"),
  scopeId: z.string().regex(UUID_RE),
  lineItemFieldId: z.string().regex(UUID_RE),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_PHOTO_MIME_TYPES, { error: "Unsupported file type." }),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_SIZE_BYTES, { error: "File is too large." }),
});

export async function POST(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

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

  const { scopeId, lineItemFieldId, contentType } = result.data;

  // The object key is built entirely from server-validated components — the
  // client's own fileName is never interpolated into it (it's kept only as
  // display metadata, see purchase_requisition_line_item_attachments.file_name),
  // so nothing client-supplied can influence where the object actually lands.
  const extension = PHOTO_EXTENSION_BY_MIME_TYPE[contentType];
  const storagePath =
    `${PR_LINE_ITEM_PHOTO_PATH_PREFIX}/${scopeId}/${lineItemFieldId}/${crypto.randomUUID()}.${extension}`;

  // Session-scoped client, not admin.ts — createSignedUploadUrl needs
  // storage.objects insert permission, which the attachments_insert_authenticated
  // policy already grants to any active user's own session, consistent with
  // admin.ts's own documented "don't reach for it as a shortcut around RLS
  // elsewhere" convention.
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET.ATTACHMENTS)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[api/uploads/sign:POST]", error);
    return NextResponse.json(
      { error: { message: "Couldn't prepare this upload. Try again." } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: { storagePath: data.path, token: data.token, signedUrl: data.signedUrl },
  });
}
