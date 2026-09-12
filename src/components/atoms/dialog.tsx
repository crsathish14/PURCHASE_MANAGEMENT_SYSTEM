"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Same createPortal-into-document.body technique as Menu (src/components/atoms/menu.tsx),
// but centered with a backdrop instead of anchored to a trigger.
export type DialogSize = "md" | "lg" | "xl";

const SIZE_CLASSES: Record<DialogSize, string> = {
  md: "max-w-md",
  // Matches Design-docs/design-spec.html's "Modal L 720px" token (Create PR).
  lg: "max-w-[720px]",
  // Wider than the design spec's documented L/720px token — Create/Edit
  // Requisition's line items table (dynamic per-category columns + a Photos
  // column) outgrew 720px once the sign-off fields were added alongside it.
  xl: "max-w-[1200px]",
};

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: DialogSize;
  // Rendered as a shrink-0 section pinned below the scrollable body — for a
  // dialog long enough to scroll (e.g. Create/Edit Requisition), this keeps
  // the CTAs reachable without following the body's scroll. Omit it for a
  // short dialog whose own inline button row never needs to leave the flow.
  footer?: ReactNode;
  // Default z-30 stacks correctly above every other Dialog-based dialog.
  // CompareQuotesModal (rfq/compare-quotes-modal.tsx) is the one screen in
  // the app that isn't built on this atom (it needs a near-fullscreen custom
  // layout) and uses z-40 — AwardConfirmDialog is the one Dialog that can be
  // opened while that modal is showing, so it passes z-50 here to render on
  // top of it instead of behind it.
  zIndexClassName?: string;
};

export function Dialog({ open, onClose, title, children, size = "md", footer, zIndexClassName = "z-30" }: DialogProps) {
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
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-ink/40 px-4 py-8`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-full w-full ${SIZE_CLASSES[size]} flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e2)`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-6 pb-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line px-6 pt-4 pb-6">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
