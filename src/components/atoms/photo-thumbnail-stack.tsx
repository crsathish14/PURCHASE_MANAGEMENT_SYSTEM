"use client";

import type { ReactNode } from "react";

import type { PreviewImage } from "./image-preview-modal";

export type PhotoThumbnailStackProps = {
  images: PreviewImage[];
  onSelect: (index: number) => void;
  ariaLabel: (count: number) => string;
  // Only rendered for the single-photo tile — once 2+ photos collapse into
  // one stack tile there's no longer a single item to attach a per-tile
  // overlay (e.g. a hover-remove button) to; removing one then happens from
  // within the gallery instead (see ImagePreviewModal's onRemove).
  renderSingleOverlay?: (image: PreviewImage, index: number) => ReactNode;
};

// Shared between the editable line-item photo picker and the read-only
// vendor-quote view: 0-1 photos render as a single square tile; 2+ collapse
// into one stack tile (front photo, thin peeking edges behind it, a count
// badge) so a line item with many photos doesn't spill into a long row of
// squares. Either way, selecting it opens the same full gallery at the front
// photo.
export function PhotoThumbnailStack({ images, onSelect, ariaLabel, renderSingleOverlay }: PhotoThumbnailStackProps) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    const image = images[0];
    return (
      <div className="group relative h-10 w-10 overflow-hidden rounded-md border border-line">
        <button type="button" onClick={() => onSelect(0)} aria-label={ariaLabel(1)} className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage
              URL (or a local blob: preview for a not-yet-reloaded upload),
              next/image's remote loader isn't configured for either. */}
          <img src={image.url ?? undefined} alt="" className="h-full w-full object-cover" />
        </button>
        {renderSingleOverlay?.(image, 0)}
      </div>
    );
  }

  return (
    <div className="relative h-11 w-11">
      {images.length >= 3 ? (
        <div aria-hidden="true" className="absolute top-1 left-1 h-10 w-10 rounded-md border border-line bg-chip-bg" />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute top-0.5 left-0.5 h-10 w-10 rounded-md border border-line bg-chip-bg"
      />
      <button
        type="button"
        onClick={() => onSelect(0)}
        aria-label={ariaLabel(images.length)}
        className="absolute top-0 left-0 h-10 w-10 overflow-hidden rounded-md border border-line"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage
            URL (or a local blob: preview for a not-yet-reloaded upload),
            next/image's remote loader isn't configured for either. */}
        <img src={images[0].url ?? undefined} alt="" className="h-full w-full object-cover" />
      </button>
      <span
        aria-hidden="true"
        className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-paper bg-ink px-1 text-[10px] leading-none font-medium text-paper"
      >
        {images.length}
      </span>
    </div>
  );
}
