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

const t = en.staff.poRequests.issueRfqDialog;

const DEFAULT_VALUES: IssueRfqLinkInput = {
  vendorName: "",
  vendorEmail: "",
  expiresAt: "",
  message: t.messageDefault,
};

// The date/time inputs report local wall-clock values with no timezone
// info — parsing "{date}T{time}" with the Date constructor (no trailing
// "Z"/offset) is interpreted as the browser's own local time per the
// ECMAScript spec, so toISOString() below correctly converts "6pm in
// whatever timezone the officer is actually in" to an absolute UTC
// instant, rather than the server guessing/misreading it as UTC directly.
function combineExpiryDateTime(date: string, time: string): string {
  if (!date || !time) return "";
  const combined = new Date(`${date}T${time}`);
  if (Number.isNaN(combined.getTime())) return "";
  return combined.toISOString();
}

export type IssueRfqDialogProps = {
  open: boolean;
  onClose: () => void;
  requisitionId: string;
  prNumber: string;
  onIssued: () => void;
};

type Result = {
  link: string;
  message: string;
};

export function IssueRfqDialog({ open, onClose, requisitionId, prNumber, onIssued }: IssueRfqDialogProps) {
  const [phase, setPhase] = useState<"form" | "result">("form");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  // Not part of the RHF-tracked/validated shape — expiresAt (a single ISO
  // datetime, the actual wire value) is what's registered/validated;
  // these two are just the raw native inputs that get combined into it.
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
    defaultValues: DEFAULT_VALUES,
  });

  const [vendorName, vendorEmail, expiresAt, message] = watch([
    "vendorName",
    "vendorEmail",
    "expiresAt",
    "message",
  ]);
  const requiredFieldsFilled = Boolean(vendorName && vendorEmail && expiresAt && message);
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
    reset(DEFAULT_VALUES);
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
      const response = await fetch(`/api/purchase-requisitions/${requisitionId}/rfq-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.issueError);
        return;
      }

      setResult({
        link: payload.data.link,
        message: `${payload.data.message}\n\n${payload.data.link}`,
      });
      setPhase("result");
      onIssued();
    } catch {
      toast.error(t.issueError);
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
              {t.done}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.resultDescription}</p>

        <div className="mb-4">
          <Label htmlFor="rfq-result-link">{t.linkLabel}</Label>
          <Input
            id="rfq-result-link"
            readOnly
            value={result.link}
            onFocus={(event) => event.currentTarget.select()}
            endAdornment={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.link, "link")}
              >
                {copied === "link" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                {copied === "link" ? t.copied : t.copy}
              </Button>
            }
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="rfq-result-message" className="text-xs font-bold text-ink">
              {t.messageLabel}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(result.message, "message")}
            >
              {copied === "message" ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <Copy size={14} strokeWidth={2} />
              )}
              {copied === "message" ? t.copied : t.copy}
            </Button>
          </div>
          <Textarea id="rfq-result-message" readOnly rows={6} value={result.message} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`${t.title} — ${prNumber}`}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            form="issue-rfq-link-form"
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

      <form id="issue-rfq-link-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4">
          <Label htmlFor="rfq-vendor-name" error={!!errors.vendorName}>
            {t.vendorName}
          </Label>
          <Input
            id="rfq-vendor-name"
            type="text"
            placeholder={t.vendorNamePlaceholder}
            error={errors.vendorName?.message}
            {...register("vendorName")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="rfq-vendor-email" error={!!errors.vendorEmail}>
            {t.vendorEmail}
          </Label>
          <Input
            id="rfq-vendor-email"
            type="email"
            placeholder={t.vendorEmailPlaceholder}
            error={errors.vendorEmail?.message}
            {...register("vendorEmail")}
          />
        </div>

        <div className="mb-4">
          <Label error={!!errors.expiresAt}>{t.expiresAt}</Label>
          <div className="flex gap-2.5">
            <Input
              type="date"
              min={todayDateString()}
              aria-label={t.expiresAtDateLabel}
              value={expiresAtDate}
              onChange={(event) => updateExpiresAtDate(event.target.value)}
              className="flex-1"
            />
            <Input
              type="time"
              aria-label={t.expiresAtTimeLabel}
              value={expiresAtTime}
              onChange={(event) => updateExpiresAtTime(event.target.value)}
              className="flex-1"
            />
          </div>
          {errors.expiresAt ? <p className="mt-1 text-[11px] text-rust">{errors.expiresAt.message}</p> : null}
          <input type="hidden" {...register("expiresAt")} />
        </div>

        <div>
          <Label htmlFor="rfq-message" error={!!errors.message}>
            {t.message}
          </Label>
          <Textarea id="rfq-message" rows={5} error={errors.message?.message} {...register("message")} />
        </div>
      </form>
    </Dialog>
  );
}
