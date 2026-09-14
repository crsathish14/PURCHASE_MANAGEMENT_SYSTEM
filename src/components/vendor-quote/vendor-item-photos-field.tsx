"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";

import { ImagePreviewModal, PhotoThumbnailStack, type PreviewImage } from "@/components/atoms";
import en from "@/locales/en.json";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from "@/lib/constants/storage";
import type { AllowedPhotoMimeType } from "@/lib/constants/storage";
import { resizeAndReencode } from "@/lib/purchase-requisition/photo-processing";
import { uploadVendorQuotePhoto, type VendorQuotePhoto } from "@/lib/vendor-quote/upload-vendor-quote-photo";

// Trimmed clone of purchase-requisition/line-item-photos-field.tsx for the
// anonymous vendor quote form — same pending/uploading/error tile UX, same
// generic resizeAndReencode() and micro-copy (reused verbatim from
// en.staff.poRequests.createDialog, a genuinely identical UI concept). The
// one real simplification: every photo here was uploaded in *this* browser
// session (a vendor never reloads mid-quote to see a server-signed display
// URL come back), so `previewUrl` is just the local blob URL for the entire
// lifetime of the field — no separate "already has a real signed url"
// bookkeeping like the office-side field needs for its edit-mode reload case.
const t = en.staff.poRequests.createDialog;

export type VendorPhotoValue = VendorQuotePhoto & { previewUrl: string };

export type VendorItemPhotosFieldProps = {
  token: string;
  lineItemId: string;
  value: VendorPhotoValue[];
  onChange: (next: VendorPhotoValue[]) => void;
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

export function VendorItemPhotosField({ token, lineItemId, value, onChange }: VendorItemPhotosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const pendingPreviewUrls = useMemo(() => pending.map((tile) => tile.previewUrl), [pending]);
  useEffect(() => {
    return () => {
      pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPreviewUrls]);

  // value's own preview URLs are only ever revoked on final unmount — each
  // line item's field stays mounted for the vendor form's whole lifetime
  // (line items never get added/removed after the page loads), so there's no
  // earlier point where these would otherwise leak.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    return () => {
      valueRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
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

      const photo = await uploadVendorQuotePhoto({
        token,
        lineItemId,
        blob: uploadBlob,
        fileName: file.name,
        contentType: uploadContentType,
      });

      onChange([...value, { ...photo, previewUrl: URL.createObjectURL(uploadBlob) }]);
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
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(value.filter((_, i) => i !== index));
  }

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    // No cap on photos per line item — matches this codebase's existing
    // office-side convention (see line-item-photos-field.tsx).
    picked.forEach(startUpload);
  }

  const previewImages: PreviewImage[] = value.map((photo) => ({ url: photo.previewUrl, fileName: photo.fileName }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <PhotoThumbnailStack
          images={previewImages}
          onSelect={(index) => setPreviewIndex(index)}
          ariaLabel={(count) => (count > 1 ? t.viewPhotoStack.replace("{count}", String(count)) : t.viewPhoto)}
          renderSingleOverlay={(_image, index) => (
            <button
              type="button"
              aria-label={t.removePhoto}
              onClick={() => removeDone(index)}
              className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center bg-ink/60 text-paper opacity-0 group-hover:opacity-100"
            >
              <X size={10} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        />

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
                <button type="button" aria-label={t.retryPhoto} onClick={() => retryUpload(tile.clientId)} className="text-rust">
                  <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
                </button>
                <button type="button" aria-label={t.removePhoto} onClick={() => removePending(tile.clientId)} className="text-rust">
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={t.addPhoto}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-[#C9D2E0] text-harbor hover:bg-harbor-50"
        >
          +
        </button>
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
        onRemove={removeDone}
      />
    </>
  );
}
