import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import type { AllowedPhotoMimeType } from "@/lib/constants/storage";
import { createClient } from "@/lib/supabase/client";

const t = en.staff.poRequests.createDialog;

export type VendorQuotePhoto = {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type UploadVendorQuotePhotoInput = {
  token: string;
  lineItemId: string;
  blob: Blob;
  fileName: string;
  contentType: AllowedPhotoMimeType;
};

// The anonymous-vendor analog of upload-line-item-photo.ts's own
// sign -> uploadToSignedUrl sequence — same shape, pointed at
// /api/quote/[token]/photos/sign instead, which re-validates the token
// itself (no session exists to gate this any other way).
export async function uploadVendorQuotePhoto({
  token,
  lineItemId,
  blob,
  fileName,
  contentType,
}: UploadVendorQuotePhotoInput): Promise<VendorQuotePhoto> {
  const signResponse = await fetch(`/api/quote/${token}/photos/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineItemId, fileName, contentType, sizeBytes: blob.size }),
  });
  const signPayload = await signResponse.json();
  if (!signResponse.ok) throw new Error(signPayload?.error?.message ?? t.photoUploadError);
  const { storagePath, token: uploadToken } = signPayload.data as { storagePath: string; token: string };

  const supabase = createClient();
  // contentType MUST be passed explicitly — uploadToSignedUrl otherwise
  // defaults to "text/plain;charset=UTF-8", which the bucket's
  // allowed_mime_types would reject regardless of the file's real type.
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET.ATTACHMENTS)
    .uploadToSignedUrl(storagePath, uploadToken, blob, { contentType });
  if (uploadError) throw uploadError;

  return { storagePath, fileName, contentType, sizeBytes: blob.size };
}
