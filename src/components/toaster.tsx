"use client";

import { useToastStore, type ToastTone } from "@/store/toast-store";

// Ref: Design-docs/design-spec.html §05 — Toast / notification.
const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-moss bg-moss-bg text-ink",
  error: "border-rust bg-rust-bg text-ink",
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2 rounded-md border-l-[3px] px-3 py-2.5 text-[12.5px] shadow-(--shadow-e2) ${TONE_CLASSES[t.tone]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="text-slate-lt hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
