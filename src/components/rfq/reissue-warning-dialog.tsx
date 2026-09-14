"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

// Only ever shown before reissuing a link whose vendor already submitted a
// quote (rfq-links-dialog.tsx) — reissuing an Expired link skips straight to
// ReissueRfqDialog, since there's no existing quote to lose there. Confirming
// here just opens that same ReissueRfqDialog; the actual delete+reissue only
// happens once that form is submitted.
const t = en.staff.requestedQuote.linksDialog.reissueWarningDialog;

export type ReissueWarningDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  vendorName: string;
};

export function ReissueWarningDialog({ open, onClose, onConfirm, vendorName }: ReissueWarningDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t.title}>
      <p className="text-sm text-slate">{t.message.replace("{vendorName}", vendorName)}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          {t.confirm}
        </Button>
      </div>
    </Dialog>
  );
}
