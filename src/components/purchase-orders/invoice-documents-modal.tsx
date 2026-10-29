"use client";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.invoiceLog.invoiceDocumentsModal;

export type InvoiceDocumentItem = {
  id: string;
  documentType: "invoice" | "supporting";
  originalFilename: string;
  sortOrder: number;
  signedUrl: string | null;
  storagePath: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  requisitionId: string;
  docs: InvoiceDocumentItem[];
  loadError: string | null;
};

function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "xls" || ext === "xlsx") return "XLS";
  return "FILE";
}

function iconColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "bg-rust/10 text-rust";
  if (ext === "doc" || ext === "docx") return "bg-ocean/10 text-ocean";
  if (ext === "xls" || ext === "xlsx") return "bg-moss/10 text-moss";
  return "bg-slate/10 text-slate";
}

function FileCard({ doc, requisitionId }: { doc: InvoiceDocumentItem; requisitionId: string }) {
  const href = `/api/purchase-orders/${requisitionId}/invoice-documents/${doc.id}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-line bg-mist/50 px-3 py-2.5 transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${iconColor(doc.originalFilename)}`}
      >
        {fileIcon(doc.originalFilename)}
      </span>
      <span className="min-w-0 break-all text-sm font-medium text-ink">{doc.originalFilename}</span>
    </a>
  );
}

export function InvoiceDocumentsModal({ open, onClose, requisitionId, docs, loadError }: Props) {
  const invoiceDocs = docs.filter((d) => d.documentType === "invoice");
  const supportingDocs = docs.filter((d) => d.documentType === "supporting");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      }
    >
      {loadError ? (
        <p className="text-sm text-rust" role="alert">
          {loadError}
        </p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate">{t.noDocuments}</p>
      ) : (
        <div className="space-y-5">
          {invoiceDocs.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">
                {t.invoiceSection}
              </h3>
              <div className="space-y-2">
                {invoiceDocs.map((doc) => (
                  <FileCard key={doc.id} doc={doc} requisitionId={requisitionId} />
                ))}
              </div>
            </section>
          ) : null}
          {supportingDocs.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">
                {t.supportingSection}
              </h3>
              <div className="space-y-2">
                {supportingDocs.map((doc) => (
                  <FileCard key={doc.id} doc={doc} requisitionId={requisitionId} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
