// Single source of truth for the shared Supabase Storage subsystem: bucket
// name, per-file/per-line-item limits, allowed mime types, and the path
// convention this feature's objects live under. Any future upload feature
// (PO/invoice attachments, etc.) reuses this same bucket and this same
// signing route (src/app/api/uploads/sign/route.ts) rather than inventing
// its own — see that route and plans/development.md §11 for how a second
// feature plugs in.
export const STORAGE_BUCKET = { ATTACHMENTS: "attachments" } as const;

// Mirrors the `attachments` bucket's own file_size_limit/allowed_mime_types
// settings (see supabase/migrations/20260823190000_storage_attachments_policies.sql)
// — duplicated here only for fast client-side pre-validation and for
// api/uploads/sign's own pre-check before it bothers asking Storage for a
// signed URL. The bucket's own settings are the real enforcement boundary: a
// signed-upload-URL flow means file bytes never pass through our server, so
// nothing server-side can inspect real bytes to double-check these numbers —
// keep both sides in sync by hand if either changes.
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS_PER_LINE_ITEM = 5;

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
// see api/uploads/sign) — a future feature (e.g. PO documents) adds its own
// sibling prefix under the same bucket instead of colliding with this one.
export const PR_LINE_ITEM_PHOTO_PATH_PREFIX = "pr-line-items";

// TTL for the *display* signed URLs getPurchaseRequisitionById re-issues on
// every read (nothing persists these). Unrelated to, and NOT how you'd
// configure, the *upload* signed URL's expiry — createSignedUploadUrl fixes
// that at 2 hours server-side, not configurable via this SDK.
export const SIGNED_DISPLAY_URL_TTL_SECONDS = 60 * 60; // 1 hour
