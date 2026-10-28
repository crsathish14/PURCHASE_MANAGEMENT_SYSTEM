"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import {
  INVOICE_DOCUMENT_INVOICE_MIME_TYPE,
  MAX_SUPPORTING_DOCS,
  STORAGE_BUCKET,
  SUPPORTING_DOC_MIME_TYPES,
} from "@/lib/constants/storage";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

const t = en.vendorInvoice;

type UploadState = { storagePath: string; filename: string };
type SignResult = { data?: { storagePath: string; token: string }; error?: { message: string } };
type SubmitResult = { data?: { success: true }; error?: { message: string } };

const ACCEPTED_SUPPORTING = SUPPORTING_DOC_MIME_TYPES.join(",") + ",.doc,.docx,.xls,.xlsx";

export function VendorInvoiceForm({
  token,
  prNumber,
  vesselLabel,
  vendorName,
}: {
  token: string;
  prNumber: string;
  vesselLabel: string | null;
  vendorName: string;
}) {
  const router = useRouter();
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const supportingInputRef = useRef<HTMLInputElement>(null);

  const [invoiceUpload, setInvoiceUpload] = useState<UploadState | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [supportingUploads, setSupportingUploads] = useState<UploadState[]>([]);
  const [supportingUploading, setSupportingUploading] = useState(false);
  const [supportingError, setSupportingError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function uploadFile(
    file: File,
    documentType: "invoice" | "supporting",
  ): Promise<UploadState | null> {
    const signResponse = await fetch(`/api/purchase-order/${token}/invoice/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || INVOICE_DOCUMENT_INVOICE_MIME_TYPE,
        documentType,
      }),
    });
    const signPayload = (await signResponse.json().catch(() => null)) as SignResult | null;
    if (!signResponse.ok || !signPayload?.data) {
      const msg = signPayload?.error?.message ?? t.uploadError;
      if (msg === t.linkExpired) throw new Error(t.linkExpired);
      throw new Error(t.uploadError);
    }
    const { storagePath, token: uploadToken } = signPayload.data;
    const { error } = await createClient()
      .storage.from(STORAGE_BUCKET.ATTACHMENTS)
      .uploadToSignedUrl(storagePath, uploadToken, file, { contentType: file.type });
    if (error) throw new Error(t.uploadError);
    return { storagePath, filename: file.name };
  }

  async function handleInvoicePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== INVOICE_DOCUMENT_INVOICE_MIME_TYPE)) {
      setInvoiceError(t.invoiceTypeError);
      return;
    }

    setInvoiceError(null);
    setInvoiceUploading(true);
    try {
      const result = await uploadFile(file, "invoice");
      setInvoiceUpload(result);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : t.uploadError);
    } finally {
      setInvoiceUploading(false);
    }
  }

  async function handleSupportingPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    if (supportingUploads.length + files.length > MAX_SUPPORTING_DOCS) {
      setSupportingError(t.supportingMaxError);
      return;
    }

    const allowedTypes = SUPPORTING_DOC_MIME_TYPES as readonly string[];
    const allowedExts = ["pdf", "doc", "docx", "xls", "xlsx"];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if ((file.type && !allowedTypes.includes(file.type)) || !allowedExts.includes(ext)) {
        setSupportingError(t.supportingTypeError);
        return;
      }
    }

    setSupportingError(null);
    setSupportingUploading(true);
    try {
      const results: UploadState[] = [];
      for (const file of files) {
        const result = await uploadFile(file, "supporting");
        if (result) results.push(result);
      }
      setSupportingUploads((prev) => [...prev, ...results]);
    } catch (err) {
      setSupportingError(err instanceof Error ? err.message : t.uploadError);
    } finally {
      setSupportingUploading(false);
    }
  }

  function removeSupporting(index: number) {
    setSupportingUploads((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceUpload || submitting) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-order/${token}/invoice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoicePath: invoiceUpload.storagePath,
          invoiceFilename: invoiceUpload.filename,
          supportingDocs: supportingUploads.map((u) => ({
            storagePath: u.storagePath,
            originalFilename: u.filename,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as SubmitResult | null;
      if (!response.ok || !payload?.data?.success) {
        const msg = payload?.error?.message ?? t.submitError;
        setSubmitError(msg === t.linkExpired ? t.linkExpired : t.submitError);
        return;
      }
      router.replace(ROUTES.PURCHASE_ORDER_INVOICE_THANK_YOU);
    } catch {
      setSubmitError(t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = invoiceUploading || supportingUploading || submitting;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      {/* Order reference */}
      <section className="rounded-lg border border-line bg-mist/50 px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate">{t.orderRef}</p>
            <p className="mt-1 font-mono text-sm font-medium text-ink">{prNumber}</p>
          </div>
          {vesselLabel ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate">{t.vessel}</p>
              <p className="mt-1 text-sm text-ink">{vesselLabel}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate">{t.vendorLabel}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{vendorName}</p>
          </div>
        </div>
      </section>

      {/* Invoice upload */}
      <section className="rounded-lg border border-line bg-mist px-4 py-4">
        <h2 className="font-display text-base font-semibold text-ink">{t.invoiceSection}</h2>
        <div className="mt-4">
          {invoiceUpload ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
              <p className="min-w-0 break-all text-sm text-ink">{invoiceUpload.filename}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => setInvoiceUpload(null)}
                aria-label={t.removeFile}
                className="shrink-0 rounded-md p-2 text-rust transition-colors hover:bg-rust/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => invoiceInputRef.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-white px-4 py-5 text-center transition-colors hover:border-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="font-medium text-ink">
                  {invoiceUploading ? t.uploadingFile : t.dropInvoice}
                </span>
                <span className="mt-1 text-sm text-slate">{t.chooseInvoice}</span>
              </button>
              <input
                ref={invoiceInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                disabled={busy}
                onChange={(event) => void handleInvoicePick(event)}
              />
            </>
          )}
        </div>
        {invoiceError ? (
          <p role="alert" className="mt-3 text-sm text-rust">
            {invoiceError}
          </p>
        ) : null}
      </section>

      {/* Supporting documents */}
      <section className="rounded-lg border border-line bg-mist px-4 py-4">
        <h2 className="font-display text-base font-semibold text-ink">{t.supportingSection}</h2>
        <div className="mt-4 space-y-2">
          {supportingUploads.map((upload, index) => (
            <div
              key={upload.storagePath}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5"
            >
              <p className="min-w-0 break-all text-sm text-ink">{upload.filename}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeSupporting(index)}
                aria-label={t.removeFile}
                className="shrink-0 rounded-md p-2 text-rust transition-colors hover:bg-rust/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ))}
          {supportingUploads.length < MAX_SUPPORTING_DOCS ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => supportingInputRef.current?.click()}
                className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-line bg-white px-4 py-3 text-sm font-medium text-slate transition-colors hover:border-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                {supportingUploading ? t.uploadingFile : t.uploadSupporting}
              </button>
              <input
                ref={supportingInputRef}
                type="file"
                accept={ACCEPTED_SUPPORTING}
                multiple
                hidden
                disabled={busy}
                onChange={(event) => void handleSupportingPick(event)}
              />
            </>
          ) : null}
        </div>
        {supportingError ? (
          <p role="alert" className="mt-3 text-sm text-rust">
            {supportingError}
          </p>
        ) : null}
      </section>

      {submitError ? (
        <p role="alert" className="text-sm text-rust">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!invoiceUpload || busy} loading={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </div>
    </form>
  );
}
