"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { DELIVERY_NOTE_MIME_TYPE, STORAGE_BUCKET } from "@/lib/constants/storage";
import type { DeliveryNoteFile } from "@/lib/data/delivery-notes";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/store/toast-store";

const t = en.staff.deliveryNotes.uploader;

type SignResult = { data?: { storagePath: string; token: string }; error?: { message: string } };
type RegisterResult = { data?: DeliveryNoteFile; error?: { message: string } };

function isPdf(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf") && (!file.type || file.type === DELIVERY_NOTE_MIME_TYPE);
}

// Picks one PDF and uploads it: sign -> uploadToSignedUrl -> register. The
// register step (POST /api/delivery-notes) is what actually creates the note,
// so a failure anywhere before it leaves nothing in the app. Shared by the
// "Add delivery or service note" picker and the per-requisition notes dialog.
export function DeliveryNoteUploader({
  requisitionId,
  onUploaded,
  onCancel,
  cancelLabel,
}: {
  requisitionId: string;
  onUploaded: (note: DeliveryNoteFile) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!picked) return;
    if (!isPdf(picked)) {
      setFile(null);
      setError(t.notPdf);
      return;
    }
    setError(null);
    setFile(picked);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const signResponse = await fetch("/api/delivery-notes/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requisitionId,
          fileName: file.name,
          contentType: DELIVERY_NOTE_MIME_TYPE,
        }),
      });
      const signPayload = (await signResponse.json().catch(() => null)) as SignResult | null;
      if (!signResponse.ok || !signPayload?.data) {
        throw new Error(signPayload?.error?.message ?? t.uploadError);
      }
      const { storagePath, token } = signPayload.data;

      // contentType must be explicit — uploadToSignedUrl otherwise sends
      // text/plain, which the bucket's allowed_mime_types would reject.
      const { error: uploadError } = await createClient()
        .storage.from(STORAGE_BUCKET.ATTACHMENTS)
        .uploadToSignedUrl(storagePath, token, file, { contentType: DELIVERY_NOTE_MIME_TYPE });
      if (uploadError) throw new Error(t.uploadError);

      const registerResponse = await fetch("/api/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requisitionId, storagePath, originalFilename: file.name }),
      });
      const registerPayload = (await registerResponse.json().catch(() => null)) as RegisterResult | null;
      if (!registerResponse.ok || !registerPayload?.data) {
        throw new Error(registerPayload?.error?.message ?? t.uploadError);
      }

      toast.success(t.uploaded);
      setFile(null);
      onUploaded(registerPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.uploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" hidden onChange={handlePick} />
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line bg-mist/50 px-4 py-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {file ? t.chooseAnother : t.choosePdf}
        </Button>
        <span className="min-w-0 break-all text-sm text-slate">{file ? file.name : t.noFileChosen}</span>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-rust" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2.5">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={uploading}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="button" variant="primary" onClick={() => void handleUpload()} disabled={!file} loading={uploading}>
          {t.upload}
        </Button>
      </div>
    </div>
  );
}
