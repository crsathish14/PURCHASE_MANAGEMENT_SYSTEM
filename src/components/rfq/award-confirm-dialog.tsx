"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.requestedQuote.linksDialog.awardDialog;

export type AwardConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  vendorName: string;
  prNumber: string;
  loading: boolean;
};

// Same trivial confirm/cancel shape as reissue-warning-dialog.tsx/
// cancel-pr-dialog.tsx, but passes zIndexClassName="z-50" since this is the
// one confirm dialog that can be opened from inside CompareQuotesModal
// (a bespoke z-40 createPortal, not built on this same Dialog atom) — see
// dialog.tsx's own comment on that prop. Takes a `loading` prop like
// CancelPrDialog, not ReissueWarningDialog, since confirming here fires a
// real network call rather than just switching to another dialog.
export function AwardConfirmDialog({
  open,
  onClose,
  onConfirm,
  vendorName,
  prNumber,
  loading,
}: AwardConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t.title} zIndexClassName="z-50">
      <p className="text-sm text-slate">
        {t.message.replace("{prNumber}", prNumber).replace("{vendorName}", vendorName)}
      </p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          {t.cancel}
        </Button>
        <Button type="button" variant="primary" onClick={onConfirm} loading={loading}>
          {loading ? t.confirming : t.confirm}
        </Button>
      </div>
    </Dialog>
  );
}
