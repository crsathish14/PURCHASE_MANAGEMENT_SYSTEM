"use client";

import { useState } from "react";

import { Check, Copy } from "lucide-react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import { EmailSubjectField } from "@/components/email-templates/email-subject-field";
import { useEmailTemplate } from "@/components/email-templates/use-email-template";
import { EMAIL_TEMPLATE_KEY } from "@/lib/constants/email-template";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";

const t = en.staff.invoiceLog.requestInvoiceDialog;
const tLog = en.staff.invoiceLog;
const tTemplate = en.staff.emailTemplates.dialog;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requisitionId: string;
  vendorName: string;
  vendorEmails: string[];
};

type CreateResult = {
  data?: { token: string; link: string; message: string };
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
  const template = useEmailTemplate(EMAIL_TEMPLATE_KEY.TAX_INVOICE, requisitionId);
  // The saved template, plus this dialog's own one-off edit (never saved back).
  const [editedMessage, setEditedMessage] = useState<string | null>(null);
  const message = editedMessage ?? (template.status === "ready" ? template.body : "");
  const templateSubject = template.status === "ready" ? template.subject : "";
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ link: string; subject: string; message: string } | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  // Once the request exists the list behind this dialog is stale, so closing from the
  // result screen reports success instead of a plain cancel.
  function close() {
    if (sending) return;
    if (result) onSuccess();
    else onClose();
  }

  async function copyToClipboard(value: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 1500);
    } catch {
      // The text stays visible and selectable if clipboard access is denied.
    }
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
      setResult({ link: payload.data.link, subject: templateSubject, message: payload.data.message });
    } catch {
      toast.error(tLog.requestInvoiceError);
    } finally {
      setSending(false);
    }
  }

  const noEmails = vendorEmails.length === 0;

  if (result) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t.resultTitle}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {t.done}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.resultDescription}</p>
        <div className="mb-4">
          <Label htmlFor="req-inv-result-link">{t.linkLabel}</Label>
          <Input
            id="req-inv-result-link"
            readOnly
            value={result.link}
            onFocus={(event) => event.currentTarget.select()}
            className="pr-24"
            endAdornment={
              <Button type="button" variant="ghost" size="sm" onClick={() => void copyToClipboard(result.link, "link")}>
                {copied === "link" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                {copied === "link" ? t.copied : t.copy}
              </Button>
            }
          />
        </div>
        <EmailSubjectField id="req-inv-result-subject" value={result.subject} copyable />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="req-inv-result-message" className="text-xs font-bold text-ink">
              {t.messageLabel}
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyToClipboard(result.message, "message")}>
              {copied === "message" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
              {copied === "message" ? t.copied : t.copy}
            </Button>
          </div>
          <Textarea id="req-inv-result-message" readOnly rows={12} value={result.message} />
        </div>
      </Dialog>
    );
  }

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
      {template.status === "loading" ? (
        <p className="text-[13px] text-slate-lt">{tTemplate.loading}</p>
      ) : template.status === "error" ? (
        <p className="text-[13px] text-rust">{tTemplate.loadError}</p>
      ) : (
        <>
          <EmailSubjectField id="req-inv-subject" value={templateSubject} />
          <div>
            <Label htmlFor="req-inv-message" required>{t.messageLabel}</Label>
            <Textarea
              id="req-inv-message"
              rows={14}
              value={message}
              onChange={(e) => setEditedMessage(e.target.value)}
              disabled={sending}
            />
          </div>
        </>
      )}
    </Dialog>
  );
}
