"use client";

import { useState } from "react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";

const t = en.staff.invoiceLog.requestInvoiceDialog;
const tLog = en.staff.invoiceLog;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requisitionId: string;
  vendorName: string;
  vendorEmails: string[];
};

type CreateResult = {
  data?: { token: string; link: string };
  error?: { message: string };
};

export function RequestInvoiceDialog({
  open,
  onClose,
  onSuccess,
  requisitionId,
  vendorName,
  vendorEmails,
}: Props) {
  const [email, setEmail] = useState(vendorEmails[0] ?? "");
  const [message, setMessage] = useState(() =>
    t.defaultMessage.replace("{vendorName}", vendorName),
  );
  const [sending, setSending] = useState(false);

  function close() {
    if (sending) return;
    onClose();
  }

  async function handleSend() {
    if (!email || !message.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(`/api/purchase-orders/${requisitionId}/invoice-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorEmail: email, message: message.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as CreateResult | null;
      if (!response.ok || !payload?.data) {
        toast.error(payload?.error?.message ?? tLog.requestInvoiceError);
        return;
      }
      toast.success(tLog.invoiceRequested);
      onSuccess();
    } catch {
      toast.error(tLog.requestInvoiceError);
    } finally {
      setSending(false);
    }
  }

  const noEmails = vendorEmails.length === 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.title}
      size="md"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close} disabled={sending}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSend()}
            loading={sending}
            disabled={!email || !message.trim() || noEmails}
          >
            {sending ? t.sending : t.send}
          </Button>
        </div>
      }
    >
      <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.subtitle}</p>
      <div className="mb-4">
        <Label htmlFor="req-inv-vendor">{t.vendorNameLabel}</Label>
        <Input id="req-inv-vendor" readOnly value={vendorName} />
      </div>
      <div className="mb-4">
        <Label htmlFor="req-inv-email" required>{t.emailLabel}</Label>
        {noEmails ? (
          <p className="mt-1 text-[13px] text-rust">{t.noEmailsError}</p>
        ) : (
          <Select
            id="req-inv-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
          >
            {vendorEmails.map((addr) => (
              <option key={addr} value={addr}>
                {addr}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="req-inv-message" required>{t.messageLabel}</Label>
        <Textarea
          id="req-inv-message"
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
        />
      </div>
    </Dialog>
  );
}
