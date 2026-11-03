"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.invoiceLog.rerequestInvoiceDialog;

export type RerequestInvoiceDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  prNumber: string;
  vendorName: string;
  loading: boolean;
};

// Confirm step for a destructive action (deletes the received tax invoice and
// its supporting documents) — same small confirm/cancel shape as mark-paid-dialog.tsx.
export function RerequestInvoiceDialog({
  open,
  onClose,
  onConfirm,
  prNumber,
  vendorName,
  loading,
}: RerequestInvoiceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t.title}>
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
