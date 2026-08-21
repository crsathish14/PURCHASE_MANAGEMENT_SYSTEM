"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Same createPortal-into-document.body technique as Menu (src/components/atoms/menu.tsx),
// but centered with a backdrop instead of anchored to a trigger.
export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-line bg-paper p-6 shadow-(--shadow-e2)"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
