"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";

import en from "@/locales/en.json";
import { Spinner } from "./spinner";

const t = en.common.imagePreview;

// Deliberately generic (no PR-specific fields) so this atom can be reused
// wherever a signed-URL-backed image needs a full-size preview — e.g. the
// vendor quote form later.
export type PreviewImage = {
  url: string | null;
  fileName: string;
};

export type ImagePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  images: PreviewImage[];
  initialIndex?: number;
};

const CONTROL_BUTTON_CLASSES =
  "flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-paper hover:bg-ink/80";

export function ImagePreviewModal({ open, onClose, images, initialIndex = 0 }: ImagePreviewModalProps) {
  if (!open || images.length === 0) return null;

  // Keying the whole panel on the guard above (mounted fresh every time it
  // opens, since the parent renders nothing while closed) means the panel's
  // own state — which photo, which images have finished loading — always
  // starts clean for this open, without needing an effect to resync it.
  return <ImagePreviewModalPanel onClose={onClose} images={images} initialIndex={initialIndex} />;
}

type ImagePreviewModalPanelProps = {
  onClose: () => void;
  images: PreviewImage[];
  initialIndex: number;
};

function ImagePreviewModalPanel({ onClose, images, initialIndex }: ImagePreviewModalPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadStatusByIndex, setLoadStatusByIndex] = useState<
    Record<number, "loaded" | "error" | undefined>
  >({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (images.length > 1 && event.key === "ArrowLeft") {
        setCurrentIndex((i) => (i - 1 + images.length) % images.length);
      }
      if (images.length > 1 && event.key === "ArrowRight") {
        setCurrentIndex((i) => (i + 1) % images.length);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, images.length]);

  const current = images[currentIndex];
  const hasMultiple = images.length > 1;
  const status: "loading" | "loaded" | "error" = !current.url
    ? "error"
    : (loadStatusByIndex[currentIndex] ?? "loading");
  const counterText = t.counter.replace("{index}", String(currentIndex + 1)).replace("{total}", String(images.length));

  function markLoaded(index: number) {
    setLoadStatusByIndex((prev) => ({ ...prev, [index]: "loaded" }));
  }
  function markErrored(index: number) {
    setLoadStatusByIndex((prev) => ({ ...prev, [index]: "error" }));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-ink/80 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.fileName}
        className="relative flex w-full max-w-4xl flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t.close}
          onClick={onClose}
          className={`${CONTROL_BUTTON_CLASSES} absolute -top-12 right-0`}
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="relative flex w-full items-center justify-center">
          {hasMultiple ? (
            <button
              type="button"
              aria-label={t.previous}
              onClick={() => setCurrentIndex((i) => (i - 1 + images.length) % images.length)}
              className={`${CONTROL_BUTTON_CLASSES} absolute left-2 z-10`}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}

          <div className="relative flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-xl">
            {status === "loading" ? (
              <div className="flex h-40 w-40 items-center justify-center text-paper">
                <Spinner size="lg" />
              </div>
            ) : null}
            {current.url && status !== "error" ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL (or a local blob: preview); next/image's remote loader isn't configured for either.
              <img
                key={currentIndex}
                src={current.url}
                alt={current.fileName}
                className={`max-h-[75vh] max-w-full rounded-xl object-contain shadow-(--shadow-e4) ${
                  status === "loaded" ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => markLoaded(currentIndex)}
                onError={() => markErrored(currentIndex)}
              />
            ) : null}
            {status === "error" ? (
              <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 text-paper/70">
                <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm">{t.unavailable}</span>
              </div>
            ) : null}
          </div>

          {hasMultiple ? (
            <button
              type="button"
              aria-label={t.next}
              onClick={() => setCurrentIndex((i) => (i + 1) % images.length)}
              className={`${CONTROL_BUTTON_CLASSES} absolute right-2 z-10`}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <p className="text-center text-sm text-paper">
          {current.fileName}
          {hasMultiple ? ` · ${counterText}` : null}
        </p>
      </div>
    </div>,
    document.body,
  );
}
