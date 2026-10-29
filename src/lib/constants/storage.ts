// Shared Supabase Storage vocabulary: bucket name, per-feature limits, allowed
// mime types, and path prefixes. Authenticated uploads use the shared signing
// route; anonymous vendor uploads use token-validating routes because Storage
// RLS cannot validate their application tokens.
export const STORAGE_BUCKET = { ATTACHMENTS: "attachments" } as const;

// Photo-only accepted types and limits are duplicated here for client-side
// pre-validation. The shared bucket limit is 5 MB; its allowed types also
// include application/pdf for vendor PO proforma submissions (see the later
// migration). The bucket remains the Storage API enforcement boundary.
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

// Client-side resize target (see line-item-photos-field.tsx) — longest edge in
// px. Anything already smaller is still re-encoded (not skipped), since
// re-encoding through Canvas is also what strips EXIF metadata (GPS/device
// info phones embed) as a side effect of the redraw, not just a size
// optimization.
export const MAX_PHOTO_DIMENSION_PX = 1920;
export const PHOTO_JPEG_QUALITY = 0.85;

// Storage object keys are always derived server-side (see api/uploads/sign)
// from a small validated vocabulary, never from a client-supplied path
// string — this map is what lets the server pick a real file extension
// without trusting the client's own (unvalidated, unsanitized) fileName.
export const PHOTO_EXTENSION_BY_MIME_TYPE: Record<AllowedPhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// Namespaces this feature's objects within the shared `attachments` bucket
// (full path: `${PR_LINE_ITEM_PHOTO_PATH_PREFIX}/${scopeId}/${lineItemFieldId}/${uuid}.${ext}`,
// see api/uploads/sign). Other upload features use sibling prefixes.
export const PR_LINE_ITEM_PHOTO_PATH_PREFIX = "pr-line-items";

// Sibling prefix for the vendor RFQ quote form's own photo uploads (full
// path: `${RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX}/${accessToken}/${lineItemId}/${uuid}.${ext}`,
// see api/quote/[token]/photos/sign) — a genuinely different signing route
// from api/uploads/sign, since this one is called by an anonymous vendor
// with no session (the RFQ link's own access token is the scope segment,
// there's no separate draft token to mint).
export const RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX = "rfq-quote-item-photos";

// Anonymous vendor PO submissions store one proforma invoice PDF per issued
// Purchase Order. The token scopes the temporary upload; the final path is
// persisted on purchase_order_issuances only when the vendor submits.
export const PURCHASE_ORDER_PROFORMA_PATH_PREFIX = "purchase-order-proformas";
export const PURCHASE_ORDER_PROFORMA_MIME_TYPE = "application/pdf" as const;
export const MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, attachments bucket limit

// TTL for the *display* signed URLs getPurchaseRequisitionById re-issues on
// every read (nothing persists these). Unrelated to, and NOT how you'd
// configure, the *upload* signed URL's expiry — createSignedUploadUrl fixes
// that at 2 hours server-side, not configurable via this SDK.
export const SIGNED_DISPLAY_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Invoice request documents: one mandatory PDF invoice + optional Word/Excel
// supporting documents. No size limit is enforced client-side; the bucket
// limit was removed via migration 20261028040000.
export const PO_INVOICE_DOCUMENT_PATH_PREFIX = "po-invoice-documents";
export const INVOICE_DOCUMENT_INVOICE_MIME_TYPE = "application/pdf" as const;
export const SUPPORTING_DOC_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type SupportingDocMimeType = (typeof SUPPORTING_DOC_MIME_TYPES)[number];
export const MAX_SUPPORTING_DOCS = 5;

export const SUPPORTING_DOC_EXTENSIONS: Record<SupportingDocMimeType, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
