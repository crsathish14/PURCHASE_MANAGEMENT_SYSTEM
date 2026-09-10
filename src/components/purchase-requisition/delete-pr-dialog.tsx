"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.poRequests.table.deleteDialog;

export type DeletePrDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  prNumber: string;
  loading: boolean;
};

export function DeletePrDialog({ open, onClose, onConfirm, prNumber, loading }: DeletePrDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t.title}>
      <p className="text-sm text-slate">{t.message.replace("{prNumber}", prNumber)}</p>
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
