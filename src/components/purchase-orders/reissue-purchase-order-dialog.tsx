"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.purchaseOrders.reissueDialog;

export type ReissuePurchaseOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  prNumber: string;
  vendorName: string;
  loading: boolean;
};

// Confirm step for a destructive action (deletes the received proforma) — same
// small confirm/cancel shape as mark-paid-dialog.tsx. It opens from inside the
// Purchase Order modal, so it needs to sit above that modal's z-40.
export function ReissuePurchaseOrderDialog({
  open,
  onClose,
  onConfirm,
  prNumber,
  vendorName,
  loading,
}: ReissuePurchaseOrderDialogProps) {
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
