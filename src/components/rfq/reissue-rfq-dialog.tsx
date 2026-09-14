"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";

import { Button, Dialog, Input, Label, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { todayDateString } from "@/lib/validation/purchase-requisition";
import { issueRfqLinkSchema, type IssueRfqLinkInput } from "@/lib/validation/rfq-link";
import { toast } from "@/store/toast-store";

// Field labels/placeholders/result-screen copy are identical in meaning to
// the normal Issue RFQ dialog, so they're reused as-is from that namespace
// rather than duplicated — only the handful of strings genuinely specific to
// reissuing (title, description, submit label, errors) live under the new
// namespace. issueRfqLinkSchema is likewise reused unchanged (same shape),
// so its Zod validation messages also come from issueT.errors, not a
// duplicate copy block here.
const issueT = en.staff.poRequests.issueRfqDialog;
const t = en.staff.requestedQuote.linksDialog.reissueDialog;

// Same local-wall-clock-to-UTC-instant reasoning as issue-rfq-dialog.tsx's
// own combineExpiryDateTime — duplicated rather than imported since it's a
// tiny pure function with no shared state to diverge.
function combineExpiryDateTime(date: string, time: string): string {
  if (!date || !time) return "";
  const combined = new Date(`${date}T${time}`);
  if (Number.isNaN(combined.getTime())) return "";
  return combined.toISOString();
}

export type ReissueRfqDialogProps = {
  open: boolean;
  onClose: () => void;
  requisitionId: string;
  linkId: string;
  vendorName: string;
  vendorEmail: string;
  onReissued: () => void;
};

type Result = {
  link: string;
  message: string;
};

export function ReissueRfqDialog({
  open,
  onClose,
  requisitionId,
  linkId,
  vendorName,
  vendorEmail,
  onReissued,
}: ReissueRfqDialogProps) {
  const [phase, setPhase] = useState<"form" | "result">("form");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [expiresAtDate, setExpiresAtDate] = useState("");
  const [expiresAtTime, setExpiresAtTime] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IssueRfqLinkInput>({
    resolver: zodResolver(issueRfqLinkSchema),
    mode: "onBlur",
    defaultValues: { vendorName, vendorEmail, expiresAt: "", message: issueT.messageDefault },
  });

  const [watchedVendorName, watchedVendorEmail, expiresAt, message] = watch([
    "vendorName",
    "vendorEmail",
    "expiresAt",
    "message",
  ]);
  const requiredFieldsFilled = Boolean(watchedVendorName && watchedVendorEmail && expiresAt && message);
  const hasErrors = Object.keys(errors).length > 0;

  function updateExpiresAtDate(date: string) {
    setExpiresAtDate(date);
    setValue("expiresAt", combineExpiryDateTime(date, expiresAtTime), { shouldValidate: true });
  }

  function updateExpiresAtTime(time: string) {
    setExpiresAtTime(time);
    setValue("expiresAt", combineExpiryDateTime(expiresAtDate, time), { shouldValidate: true });
  }

  function close() {
    onClose();
    setPhase("form");
    setResult(null);
    setCopied(null);
    setExpiresAtDate("");
    setExpiresAtTime("");
    reset({ vendorName, vendorEmail, expiresAt: "", message: issueT.messageDefault });
  }

  async function copyToClipboard(value: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 1500);
    } catch {
      // Clipboard access can be denied by the browser — the value is still
      // visible and selectable in its readonly field either way.
    }
  }

  async function onSubmit(data: IssueRfqLinkInput) {
    try {
      const response = await fetch(`/api/purchase-requisitions/${requisitionId}/rfq-links/${linkId}/reissue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.reissueError);
        return;
      }

      setResult({
        link: payload.data.link,
        message: `${payload.data.message}\n\n${payload.data.link}`,
      });
      setPhase("result");
      onReissued();
    } catch {
      toast.error(t.reissueError);
    }
  }

  if (phase === "result" && result) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t.resultTitle}
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {issueT.done}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-[13px] leading-relaxed text-slate">{issueT.resultDescription}</p>

        <div className="mb-4">
          <Label htmlFor="reissue-result-link">{issueT.linkLabel}</Label>
          <Input
            id="reissue-result-link"
            readOnly
            value={result.link}
            onFocus={(event) => event.currentTarget.select()}
            endAdornment={
              <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(result.link, "link")}>
                {copied === "link" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                {copied === "link" ? issueT.copied : issueT.copy}
              </Button>
            }
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="reissue-result-message" className="text-xs font-bold text-ink">
              {issueT.messageLabel}
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(result.message, "message")}>
              {copied === "message" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
              {copied === "message" ? issueT.copied : issueT.copy}
            </Button>
          </div>
          <Textarea id="reissue-result-message" readOnly rows={6} value={result.message} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`${t.title} — ${vendorName}`}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            {issueT.cancel}
          </Button>
          <Button
            type="submit"
            form="reissue-rfq-link-form"
            variant="primary"
            loading={isSubmitting}
            disabled={!requiredFieldsFilled || hasErrors}
          >
            {isSubmitting ? t.submitting : t.submit}
          </Button>
        </div>
      }
    >
      <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.description}</p>

      <form id="reissue-rfq-link-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4">
          <Label htmlFor="reissue-vendor-name" error={!!errors.vendorName}>
            {issueT.vendorName}
          </Label>
          <Input
            id="reissue-vendor-name"
            type="text"
            placeholder={issueT.vendorNamePlaceholder}
            error={errors.vendorName?.message}
            {...register("vendorName")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="reissue-vendor-email" error={!!errors.vendorEmail}>
            {issueT.vendorEmail}
          </Label>
          <Input
            id="reissue-vendor-email"
            type="email"
            placeholder={issueT.vendorEmailPlaceholder}
            error={errors.vendorEmail?.message}
            {...register("vendorEmail")}
          />
        </div>

        <div className="mb-4">
          <Label error={!!errors.expiresAt}>{issueT.expiresAt}</Label>
          <div className="flex gap-2.5">
            <Input
              type="date"
              min={todayDateString()}
              aria-label={issueT.expiresAtDateLabel}
              value={expiresAtDate}
              onChange={(event) => updateExpiresAtDate(event.target.value)}
              className="flex-1"
            />
            <Input
              type="time"
              aria-label={issueT.expiresAtTimeLabel}
              value={expiresAtTime}
              onChange={(event) => updateExpiresAtTime(event.target.value)}
              className="flex-1"
            />
          </div>
          {errors.expiresAt ? <p className="mt-1 text-[11px] text-rust">{errors.expiresAt.message}</p> : null}
          <input type="hidden" {...register("expiresAt")} />
        </div>

        <div>
          <Label htmlFor="reissue-message" error={!!errors.message}>
            {issueT.message}
          </Label>
          <Textarea id="reissue-message" rows={5} error={errors.message?.message} {...register("message")} />
        </div>
      </form>
    </Dialog>
  );
}
