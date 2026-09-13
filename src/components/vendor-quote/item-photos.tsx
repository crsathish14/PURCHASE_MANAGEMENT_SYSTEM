"use client";

import { useState } from "react";

import { ImagePreviewModal, PhotoThumbnailStack, type PreviewImage } from "@/components/atoms";

export type ItemPhotosCopy = {
  noPhotos: string;
  viewPhoto: string;
  viewPhotoStack: string;
};

// Shared by every vendor-quote item table (editable forms and read-only
// comparison cards alike, for all 3 categories) — was duplicated
// byte-for-byte across stores-quote-form.tsx and all 3 comparison cards
// before the Spares/Service forms also needed it, at which point 6 copies
// was one too many. Typed structurally against the minimal shape it actually
// reads rather than a shared attachment type, since RfqQuoteLineItemAttachment
// (form side) and PrLineItemAttachment (comparison-card side) are two
// genuinely different types that both happen to carry these two fields.
export function ItemPhotos({
  attachments,
  t,
}: {
  attachments: Array<{ fileName: string; url: string | null }>;
  t: ItemPhotosCopy;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (attachments.length === 0) {
    return <span className="text-xs text-slate-lt">{t.noPhotos}</span>;
  }

  const previewImages: PreviewImage[] = attachments.map((attachment) => ({
    url: attachment.url,
    fileName: attachment.fileName,
  }));

  return (
    <>
      <PhotoThumbnailStack
        images={previewImages}
        onSelect={(index) => setPreviewIndex(index)}
        ariaLabel={(count) =>
          count > 1 ? t.viewPhotoStack.replace("{count}", String(count)) : t.viewPhoto
        }
      />
      <ImagePreviewModal
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={previewImages}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}
