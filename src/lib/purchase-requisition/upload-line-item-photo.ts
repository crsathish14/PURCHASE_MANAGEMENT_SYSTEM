import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import type { AllowedPhotoMimeType } from "@/lib/constants/storage";
import { createClient } from "@/lib/supabase/client";
import type { PrLineItemAttachment } from "@/lib/data/purchase-requisition";

const t = en.staff.poRequests.createDialog;

export type UploadLineItemPhotoInput = {
  // Top-level Storage path folder — a create-mode draft token or the real
  // requisition.id in edit mode. See create-requisition-dialog.tsx.
  scopeId: string;
  // The line item's path segment — normally useFieldArray's field.id, but
  // any stable-per-line-item token works (see the import upload step in
  // po-requests-view.tsx, which doesn't have a mounted field yet).
  lineItemFieldId: string;
  blob: Blob;
  fileName: string;
  contentType: AllowedPhotoMimeType;
};

// The sign -> uploadToSignedUrl sequence shared by every path that turns a
// photo into a real attachment: a manual pick in LineItemPhotosField, and an
// imported Excel workbook's embedded images (po-requests-view.tsx). Pulled
// out so neither path can silently drift from the other — attachments must
// always reference a real, signed-upload Storage object, never a shortcut.
export async function uploadLineItemPhoto({
  scopeId,
  lineItemFieldId,
  blob,
  fileName,
  contentType,
}: UploadLineItemPhotoInput): Promise<PrLineItemAttachment> {
  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "pr-line-item-photo",
      scopeId,
      lineItemFieldId,
      fileName,
      contentType,
      sizeBytes: blob.size,
    }),
  });
  const signPayload = await signResponse.json();
  if (!signResponse.ok) throw new Error(signPayload?.error?.message ?? t.photoUploadError);
  const { storagePath, token } = signPayload.data as { storagePath: string; token: string };

  const supabase = createClient();
  // contentType MUST be passed explicitly — uploadToSignedUrl otherwise
  // defaults to "text/plain;charset=UTF-8", which the bucket's
  // allowed_mime_types would reject regardless of the file's real type.
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET.ATTACHMENTS)
    .uploadToSignedUrl(storagePath, token, blob, { contentType });
  if (uploadError) throw uploadError;

  return { storagePath, fileName, contentType, sizeBytes: blob.size, url: null };
}
