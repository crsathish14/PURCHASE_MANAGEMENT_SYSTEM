"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.deliveryNotes.deleteDialog;

export type DeleteDeliveryNoteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  // Set when this is the requisition's only note, to say it will return to the picker.
  lastNotePrNumber: string | null;
  loading: boolean;
};

export function DeleteDeliveryNoteDialog({
  open,
  onClose,
  onConfirm,
  fileName,
  lastNotePrNumber,
  loading,
}: DeleteDeliveryNoteDialogProps) {
  const message =
    t.message.replace("{fileName}", fileName) +
    (lastNotePrNumber ? t.lastNoteWarning.replace("{prNumber}", lastNotePrNumber) : "");

  return (
    // z-50 so it stacks above the notes dialog it is opened from.
    <Dialog open={open} onClose={onClose} title={t.title} zIndexClassName="z-50">
      <p className="text-sm text-slate">{message}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          {t.cancel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} loading={loading}>
          {t.confirm}
        </Button>
      </div>
    </Dialog>
  );
}
