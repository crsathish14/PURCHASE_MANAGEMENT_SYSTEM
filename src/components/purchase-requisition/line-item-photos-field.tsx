"use client";

import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import en from "@/locales/en.json";

const t = en.staff.poRequests.createDialog;

export type LineItemPhotosFieldProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

// Frontend-only photo picker for Stores/Spares line items — the backend
// storage design (bucket policies, upload path) is deliberately deferred, so
// this never registers with react-hook-form and its files never leave the
// browser. See line-items-field.tsx's photosByLineItem state for how these
// files are kept out of the submitted payload entirely.
export function LineItemPhotosField({ files, onChange, disabled = false }: LineItemPhotosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Computed during render (not via setState-in-effect) so it's available
  // for this same render's <img> tags; the effect below only handles the
  // side effect that genuinely needs one — revoking each URL once it's no
  // longer current. Recreating every URL on any add/remove is fine at this
  // scale (a handful of photos per line item).
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length) onChange([...files, ...picked]);
    event.target.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="group relative h-10 w-10 overflow-hidden rounded-md border border-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob:
              object URL for an in-memory File, next/image's remote loader
              doesn't apply here. */}
          <img src={urls[index]} alt="" className="h-full w-full object-cover" />
          {disabled ? null : (
            <button
              type="button"
              aria-label={t.removePhoto}
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center bg-ink/60 text-paper opacity-0 group-hover:opacity-100"
            >
              <X size={10} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {disabled ? null : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={t.addPhoto}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-[#C9D2E0] text-harbor hover:bg-harbor-50"
        >
          +
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handlePick} />
    </div>
  );
}
