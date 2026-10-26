"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vendor } from "@/lib/data/vendors";
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
  vendorId: string | null;
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
  vendorId,
  vendorName,
  vendorEmail,
  onReissued,
}: ReissueRfqDialogProps) {
  const [phase, setPhase] = useState<"form" | "result">("form");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [expiresAtDate, setExpiresAtDate] = useState("");
  const [expiresAtTime, setExpiresAtTime] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorLookupStatus, setVendorLookupStatus] = useState<"idle" | "loading" | "error">("idle");

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
    defaultValues: { vendorId: vendorId ?? "", vendorEmail, expiresAt: "", message: issueT.messageDefault },
  });

  useEffect(() => {
    if (!open) return;

    let active = true;
    async function loadVendors() {
      setVendorLookupStatus("loading");
      try {
        const response = await fetch("/api/vendors");
        const payload = (await response.json()) as { data?: Vendor[] };
        if (!response.ok) throw new Error("Vendor lookup failed");

        if (active) {
          const savedVendors = Array.isArray(payload.data) ? payload.data : [];
          setVendors(savedVendors);
          setVendorLookupStatus("idle");

          if (vendorId) {
            const savedVendor = savedVendors.find((vendor) => vendor.id === vendorId);
            if (savedVendor && !savedVendor.mail.includes(vendorEmail)) {
              setValue("vendorEmail", "", { shouldValidate: true });
            }
          }
        }
      } catch {
        if (active) setVendorLookupStatus("error");
      }
    }

    void loadVendors();
    return () => {
      active = false;
    };
  }, [open, vendorEmail, vendorId, setValue]);

  const [selectedVendorId, watchedVendorEmail, expiresAt, message] = watch([
    "vendorId",
    "vendorEmail",
    "expiresAt",
    "message",
  ]);
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  const displayedVendorName = selectedVendor?.name ?? vendorName;
  const requiredFieldsFilled = Boolean(
    selectedVendor &&
      watchedVendorEmail &&
      selectedVendor.mail.includes(watchedVendorEmail) &&
      expiresAt &&
      message,
  );
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
    reset({ vendorId: vendorId ?? "", vendorEmail, expiresAt: "", message: issueT.messageDefault });
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
      title={`${t.title} — ${displayedVendorName}`}
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
          <Label htmlFor="reissue-vendor-id" error={!!errors.vendorId}>
            {issueT.vendorName}
          </Label>
          {vendorId ? (
            <>
              <Input id="reissue-vendor-id" readOnly value={displayedVendorName} />
              <input type="hidden" {...register("vendorId")} />
            </>
          ) : (
            <Select
              id="reissue-vendor-id"
              error={errors.vendorId?.message}
              disabled={vendorLookupStatus !== "idle" || vendors.length === 0}
              {...register("vendorId", {
                onChange: () => setValue("vendorEmail", "", { shouldDirty: true, shouldValidate: true }),
              })}
            >
              <option value="">{issueT.vendorNamePlaceholder}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </Select>
          )}
          {vendorLookupStatus === "loading" ? (
            <p className="mt-1 text-[11px] text-slate-lt">{issueT.vendorListLoading}</p>
          ) : vendorLookupStatus === "error" ? (
            <p className="mt-1 text-[11px] text-slate-lt">{issueT.vendorListError}</p>
          ) : !vendorId && vendors.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-lt">{issueT.noVendors}</p>
          ) : null}
        </div>

        <div className="mb-4">
          <Label htmlFor="reissue-vendor-email" error={!!errors.vendorEmail}>
            {issueT.vendorEmail}
          </Label>
          <Select
            id="reissue-vendor-email"
            error={errors.vendorEmail?.message}
            disabled={!selectedVendor || selectedVendor.mail.length === 0}
            {...register("vendorEmail")}
          >
            <option value="">{selectedVendor ? issueT.vendorEmailPlaceholder : issueT.selectVendorFirst}</option>
            {selectedVendor?.mail.map((email, index) => (
              <option key={`${selectedVendor.id}-mail-${index}`} value={email}>
                {email}
              </option>
            ))}
          </Select>
          {selectedVendor?.mail.length === 0 ? (
            <p className="mt-1 text-[11px] text-rust">{issueT.vendorHasNoEmails}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-lt">{issueT.vendorSelectionHint}</p>
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
