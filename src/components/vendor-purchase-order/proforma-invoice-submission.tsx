"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import {
  MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES,
  PURCHASE_ORDER_PROFORMA_MIME_TYPE,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

const t = en.vendorPurchaseOrder;

type UploadResult = {
  data?: { storagePath: string; token: string };
  error?: { message: string };
};

type SubmitResult = {
  data?: { success: true };
  error?: { message: string };
};

type DeleteResult = {
  data?: { success: true };
  error?: { message: string };
};

type DownloadErrorResult = { error?: { message: string } };

type UploadedInvoice = { storagePath: string; fileName: string };

function responseMessage(payload: { error?: { message: string } } | null, fallback: string): string {
  return payload?.error?.message ?? fallback;
}

export function ProformaInvoiceSubmission({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<UploadedInvoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    await handleFile(file);
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== PURCHASE_ORDER_PROFORMA_MIME_TYPE)) {
      setErrorMessage(t.pdfOnlyError);
      return;
    }
    if (file.size === 0 || file.size > MAX_PURCHASE_ORDER_PROFORMA_SIZE_BYTES) {
      setErrorMessage(t.pdfSizeError);
      return;
    }

    const header = await file.slice(0, 1024).text();
    if (!header.includes("%PDF-")) {
      setErrorMessage(t.invalidPdfError);
      return;
    }

    setErrorMessage(null);
    setUploading(true);
    try {
      const signResponse = await fetch(`/api/purchase-order/${token}/proforma/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: PURCHASE_ORDER_PROFORMA_MIME_TYPE,
          sizeBytes: file.size,
        }),
      });
      const signPayload = (await signResponse.json().catch(() => null)) as UploadResult | null;
      if (!signResponse.ok || !signPayload?.data) {
        throw new Error(responseMessage(signPayload, t.uploadError));
      }

      const { storagePath, token: uploadToken } = signPayload.data;
      const { error } = await createClient()
        .storage.from(STORAGE_BUCKET.ATTACHMENTS)
        .uploadToSignedUrl(storagePath, uploadToken, file, { contentType: PURCHASE_ORDER_PROFORMA_MIME_TYPE });
      if (error) throw error;

      setUploaded({ storagePath, fileName: file.name });
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message === t.linkExpired ? t.linkExpired : t.uploadError);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploaded || uploading || submitting) return;

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-order/${token}/proforma/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploaded),
      });
      const payload = (await response.json().catch(() => null)) as SubmitResult | null;
      if (!response.ok || !payload?.data?.success) {
        throw new Error(responseMessage(payload, t.submitError));
      }
      router.replace(ROUTES.PURCHASE_ORDER_THANK_YOU);
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message === t.linkExpired ? t.linkExpired : t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!uploaded || deleting || submitting) return;

    setErrorMessage(null);
    setDeleting(true);
    try {
      const response = await fetch(`/api/purchase-order/${token}/proforma/upload`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: uploaded.storagePath }),
      });
      const payload = (await response.json().catch(() => null)) as DeleteResult | null;
      if (!response.ok || !payload?.data?.success) {
        throw new Error(responseMessage(payload, t.deleteError));
      }
      setUploaded(null);
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message === t.linkExpired ? t.linkExpired : t.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (downloading) return;

    setErrorMessage(null);
    setDownloading(true);
    try {
      const response = await fetch(`/api/purchase-order/${token}/export`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as DownloadErrorResult | null;
        setErrorMessage(responseMessage(payload, t.downloadPdfError));
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? "Purchase-Order.pdf";
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMessage(t.downloadPdfError);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <section className="rounded-lg border border-line bg-mist px-4 py-4">
        <h2 className="font-display text-base font-semibold text-ink">{t.proformaTitle}</h2>
        <p className="mt-1 text-sm text-slate">{t.proformaDescription}</p>
        <div className="mt-4">
          {uploaded ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
              <p className="min-w-0 break-all text-sm text-ink" aria-live="polite">
                {uploaded.fileName}
              </p>
              <button
                type="button"
                disabled={deleting || submitting}
                onClick={() => void handleDelete()}
                aria-label={deleting ? t.deletingPdf : t.deletePdf}
                title={deleting ? t.deletingPdf : t.deletePdf}
                className="shrink-0 rounded-md p-2 text-rust transition-colors hover:bg-rust/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={uploading || deleting || submitting}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!uploading && !deleting && !submitting) setDragOver(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  if (uploading || deleting || submitting) return;
                  const file = event.dataTransfer.files[0];
                  if (file) void handleFile(file);
                }}
                className={`flex min-h-28 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean disabled:cursor-not-allowed disabled:opacity-60 ${dragOver ? "border-ocean bg-ocean/5" : "border-line bg-white hover:border-ocean"}`}
                aria-label={uploading ? t.uploadingPdf : t.choosePdf}
              >
                <span className="font-medium text-ink">{uploading ? t.uploadingPdf : t.dropPdf}</span>
                <span className="mt-1 text-sm text-slate">{t.choosePdf}</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                disabled={uploading || deleting || submitting}
                onChange={(event) => void handlePick(event)}
              />
            </>
          )}
        </div>
        {errorMessage ? (
          <p role="alert" className="mt-3 text-sm text-rust">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <div className="flex justify-end gap-2.5">
        <Button
          type="button"
          variant="secondary"
          disabled={downloading}
          loading={downloading}
          onClick={() => void handleDownload()}
        >
          {downloading ? t.downloadingPdf : t.download}
        </Button>
        <Button type="submit" disabled={!uploaded || uploading || submitting} loading={submitting}>
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
