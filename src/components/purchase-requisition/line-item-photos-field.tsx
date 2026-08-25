"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";

import { ImagePreviewModal, type PreviewImage } from "@/components/atoms";
import en from "@/locales/en.json";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_DIMENSION_PX,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_LINE_ITEM,
  PHOTO_JPEG_QUALITY,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import type { AllowedPhotoMimeType } from "@/lib/constants/storage";
import { createClient } from "@/lib/supabase/client";

const t = en.staff.poRequests.createDialog;

export type LineItemAttachment = {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
};

export type LineItemPhotosFieldProps = {
  // Top-level Storage path folder for this line item's photos: a create-mode
  // draft token or the real requisition.id in edit mode — see
  // create-requisition-dialog.tsx.
  scopeId: string;
  // useFieldArray's field.id for this row — reused verbatim as the path's
  // line-item segment.
  lineItemFieldId: string;
  value: LineItemAttachment[];
  onChange: (next: LineItemAttachment[]) => void;
  disabled?: boolean;
};

type PendingTile =
  | { clientId: string; status: "uploading"; file: File; previewUrl: string }
  | { clientId: string; status: "error"; file: File; previewUrl: string; message: string };

// Real File.type reporting for HEIC is inconsistent across browsers/OSes
// (often "" on iOS Safari/Chrome for a .heic pick) — fall back to the
// filename extension before rejecting, so real-world iPhone photos aren't
// falsely bounced by the "unsupported type" check.
function resolveMimeType(file: File): AllowedPhotoMimeType | null {
  if ((ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type as AllowedPhotoMimeType;
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) return "image/heic";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return null;
}

// Downscales (if needed) and re-encodes a picked photo via Canvas before it's
// uploaded — cuts storage/bandwidth usage for typical multi-megabyte phone
// photos, and strips EXIF metadata (GPS/device info) as a side effect of the
// redraw. Always redraws (even when already smaller than the target) so EXIF
// stripping is applied consistently, not just when downscaling actually
// happens. Returns null on any failure — most notably, HEIC decode via
// createImageBitmap/canvas is only supported in Safari (no native codec in
// Chrome/Firefox/Edge) — the caller falls back to uploading the original,
// unmodified file in that case; this is a progressive enhancement, never a
// blocker, and the bucket's own server-enforced file_size_limit/
// allowed_mime_types apply regardless of which path is taken.
async function resizeAndReencode(
  file: File,
): Promise<{ blob: Blob; contentType: AllowedPhotoMimeType } | null> {
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

export function LineItemPhotosField({
  scopeId,
  lineItemFieldId,
  value,
  onChange,
  disabled = false,
}: LineItemPhotosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // A freshly uploaded photo's `url` is null — display signing only happens
  // server-side, in getPurchaseRequisitionById, when an existing PR is
  // loaded. Without this, a photo uploaded earlier in the *current* dialog
  // session (before Submit/reload) would render with no src at all. Keyed by
  // storagePath so it composes with reload-seeded attachments, which already
  // carry a real signed `url` and never need an entry here.
  const [localPreviewUrlByPath, setLocalPreviewUrlByPath] = useState<Record<string, string>>({});
  // A ref mirror so the unmount-only effect below can always read the latest
  // map — an empty-deps effect's own closure would otherwise stay frozen at
  // whatever localPreviewUrlByPath was on mount (always {}), silently
  // revoking nothing. Synced via its own effect, not during render — refs
  // can't be written during render (React Compiler enforces this).
  const localPreviewUrlByPathRef = useRef(localPreviewUrlByPath);
  useEffect(() => {
    localPreviewUrlByPathRef.current = localPreviewUrlByPath;
  }, [localPreviewUrlByPath]);

  const previewUrls = useMemo(() => pending.map((tile) => tile.previewUrl), [pending]);
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      Object.values(localPreviewUrlByPathRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function runUpload(clientId: string, file: File, mimeType: AllowedPhotoMimeType) {
    try {
      const resized = await resizeAndReencode(file);
      const uploadBlob: Blob = resized?.blob ?? file;
      const uploadContentType: AllowedPhotoMimeType = resized?.contentType ?? mimeType;

      if (uploadBlob.size > MAX_PHOTO_SIZE_BYTES) {
        throw new Error(t.photoTooLarge);
      }

      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "pr-line-item-photo",
          scopeId,
          lineItemFieldId,
          fileName: file.name,
          contentType: uploadContentType,
          sizeBytes: uploadBlob.size,
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
        .uploadToSignedUrl(storagePath, token, uploadBlob, { contentType: uploadContentType });
      if (uploadError) throw uploadError;

      // No server round trip has happened yet, so there's no signed display
      // URL for this attachment — use a local blob preview of the actual
      // uploaded bytes (post-resize) until the next full reload replaces it
      // with a real signed URL from the server.
      setLocalPreviewUrlByPath((prev) => ({ ...prev, [storagePath]: URL.createObjectURL(uploadBlob) }));
      onChange([
        ...value,
        {
          storagePath,
          fileName: file.name,
          contentType: uploadContentType,
          sizeBytes: uploadBlob.size,
          url: null,
        },
      ]);
      setPending((prev) => {
        const tile = prev.find((p) => p.clientId === clientId);
        if (tile) URL.revokeObjectURL(tile.previewUrl);
        return prev.filter((p) => p.clientId !== clientId);
      });
    } catch (err) {
      const message = err instanceof Error && err.message === t.photoTooLarge ? t.photoTooLarge : t.photoUploadError;
      setPending((prev) =>
        prev.map((tile) => (tile.clientId === clientId ? { ...tile, status: "error", message } : tile)),
      );
    }
  }

  function startUpload(file: File) {
    const clientId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const mimeType = resolveMimeType(file);

    if (!mimeType) {
      setPending((prev) => [
        ...prev,
        { clientId, status: "error", file, previewUrl, message: t.photoUnsupportedType },
      ]);
      return;
    }

    setPending((prev) => [...prev, { clientId, status: "uploading", file, previewUrl }]);
    void runUpload(clientId, file, mimeType);
  }

  function retryUpload(clientId: string) {
    const tile = pending.find((p) => p.clientId === clientId);
    if (!tile || tile.status !== "error") return;
    const mimeType = resolveMimeType(tile.file);
    if (!mimeType) return; // shouldn't happen — it passed this check to get here originally
    setPending((prev) =>
      prev.map((p) =>
        p.clientId === clientId
          ? { clientId, status: "uploading", file: tile.file, previewUrl: tile.previewUrl }
          : p,
      ),
    );
    void runUpload(clientId, tile.file, mimeType);
  }

  function removePending(clientId: string) {
    setPending((prev) => {
      const tile = prev.find((p) => p.clientId === clientId);
      if (tile) URL.revokeObjectURL(tile.previewUrl);
      return prev.filter((p) => p.clientId !== clientId);
    });
  }

  function removeDone(index: number) {
    const removed = value[index];
    if (removed) {
      const previewUrl = localPreviewUrlByPath[removed.storagePath];
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setLocalPreviewUrlByPath((prev) => {
          const next = { ...prev };
          delete next[removed.storagePath];
          return next;
        });
      }
    }
    onChange(value.filter((_, i) => i !== index));
  }

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;
    const remainingSlots = Math.max(MAX_PHOTOS_PER_LINE_ITEM - value.length - pending.length, 0);
    picked.slice(0, remainingSlots).forEach(startUpload);
  }

  const atLimit = value.length + pending.length >= MAX_PHOTOS_PER_LINE_ITEM;

  const previewImages: PreviewImage[] = value.map((attachment) => ({
    url: attachment.url ?? localPreviewUrlByPath[attachment.storagePath] ?? null,
    fileName: attachment.fileName,
  }));

  return (
    <>
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((attachment, index) => (
        <div
          key={attachment.storagePath}
          className="group relative h-10 w-10 overflow-hidden rounded-md border border-line"
        >
          <button
            type="button"
            onClick={() => setPreviewIndex(index)}
            aria-label={t.viewPhoto}
            className="block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage
                URL (or a local blob: preview for a not-yet-reloaded upload),
                next/image's remote loader isn't configured for either. */}
            <img
              src={attachment.url ?? localPreviewUrlByPath[attachment.storagePath] ?? undefined}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
          {disabled ? null : (
            <button
              type="button"
              aria-label={t.removePhoto}
              onClick={() => removeDone(index)}
              className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center bg-ink/60 text-paper opacity-0 group-hover:opacity-100"
            >
              <X size={10} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}

      {pending.map((tile) => (
        <div
          key={tile.clientId}
          className="group relative h-10 w-10 overflow-hidden rounded-md border border-line"
          title={tile.status === "error" ? tile.message : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob:
              object URL for an in-memory File. */}
          <img src={tile.previewUrl} alt="" className="h-full w-full object-cover opacity-50" />
          {tile.status === "uploading" ? (
            <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-chip-bg">
              <div className="h-full w-1/2 animate-pulse bg-harbor" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-rust-bg/85">
              <button
                type="button"
                aria-label={t.retryPhoto}
                onClick={() => retryUpload(tile.clientId)}
                className="text-rust"
              >
                <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t.removePhoto}
                onClick={() => removePending(tile.clientId)}
                className="text-rust"
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      ))}

      {disabled || atLimit ? null : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={t.addPhoto}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-[#C9D2E0] text-harbor hover:bg-harbor-50"
        >
          +
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
        multiple
        hidden
        onChange={handlePick}
      />
    </div>
    <ImagePreviewModal
      open={previewIndex !== null}
      onClose={() => setPreviewIndex(null)}
      images={previewImages}
      initialIndex={previewIndex ?? 0}
    />
    </>
  );
}
