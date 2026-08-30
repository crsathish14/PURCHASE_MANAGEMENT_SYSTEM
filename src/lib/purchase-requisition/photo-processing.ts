import { MAX_PHOTO_DIMENSION_PX, PHOTO_JPEG_QUALITY } from "@/lib/constants/storage";

// Downscales (if needed) and re-encodes a picked photo via Canvas before it's
// uploaded — cuts storage/bandwidth usage for typical multi-megabyte phone
// photos, and strips EXIF metadata (GPS/device info) as a side effect of the
// redraw. Always redraws (even when already smaller than the target) so EXIF
// stripping is applied consistently, not just when downscaling actually
// happens. Returns null on any failure — most notably, HEIC decode via
// createImageBitmap/canvas is only supported in Safari (no native codec in
// Chrome/Firefox/Edge) — the caller falls back to uploading the original,
// unmodified file/blob in that case; this is a progressive enhancement, never
// a blocker, and the bucket's own server-enforced file_size_limit/
// allowed_mime_types apply regardless of which path is taken.
//
// Accepts File | Blob (not just File) so a photo extracted from an imported
// Excel workbook's embedded images — which only ever exists as a Blob, never
// a File — goes through the exact same normalization as a manually-picked
// photo (see import-template-vba.ts / po-requests-view.tsx's import upload
// step), rather than a separate, divergent code path.
export async function resizeAndReencode(
  file: File | Blob,
): Promise<{ blob: Blob; contentType: "image/jpeg" } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY),
    );
    if (!blob) return null;
    return { blob, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}
