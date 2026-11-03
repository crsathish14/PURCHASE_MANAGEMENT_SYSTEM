"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";
import { MAX_DELIVERY_NOTES_PER_REQUISITION } from "@/lib/constants/storage";
import type { DeliveryNoteFile, DeliveryNoteListRow } from "@/lib/data/delivery-notes";
import { toast } from "@/store/toast-store";
import { DeleteDeliveryNoteDialog } from "./delete-delivery-note-dialog";
import { DeliveryNoteUploader } from "./delivery-note-uploader";

const t = en.staff.deliveryNotes;

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

// One requisition's notes: open, delete, or add another (up to the cap). Keeps
// its own copy of the notes so an upload/delete updates what's on screen
// immediately, whichever page of the list the row has since moved to; the
// parent's onChanged refetches the list behind it.
export function DeliveryNotesDialog({
  open,
  onClose,
  row,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  row: DeliveryNoteListRow;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<DeliveryNoteFile[]>(row.notes);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryNoteFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const atCap = notes.length >= MAX_DELIVERY_NOTES_PER_REQUISITION;

  function handleUploaded(note: DeliveryNoteFile) {
    setNotes((prev) => [...prev, note]);
    setAdding(false);
    onChanged();
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/delivery-notes/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.api.deleteError);
        return;
      }
      toast.success(t.deleteDialog.deleted);
      const remaining = notes.filter((note) => note.id !== deleteTarget.id);
      setNotes(remaining);
      setDeleteTarget(null);
      onChanged();
      // The requisition has no notes left, so it leaves this list for the picker.
      if (remaining.length === 0) onClose();
    } catch {
      toast.error(t.api.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={t.notesDialog.title}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t.notesDialog.close}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-slate">
          {t.notesDialog.subtitle
            .replace("{prNumber}", row.prNumber)
            .replace("{count}", String(notes.length))
            .replace("{max}", String(MAX_DELIVERY_NOTES_PER_REQUISITION))}
        </p>

        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-mist/50 px-3 py-2.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-rust/10 text-[11px] font-bold text-rust">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium text-ink">{note.originalFilename}</p>
                <p className="text-xs text-slate-lt" suppressHydrationWarning>
                  {t.notesDialog.uploadedOn.replace("{date}", dateFormatter.format(new Date(note.createdAt)))}
                </p>
              </div>
              <a
                href={`/api/delivery-notes/${note.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.notesDialog.viewFile.replace("{fileName}", note.originalFilename)}
                className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-harbor transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
              >
                {t.notesDialog.view}
              </a>
              <Button
                type="button"
                variant="icon"
                aria-label={t.notesDialog.deleteFile.replace("{fileName}", note.originalFilename)}
                onClick={() => setDeleteTarget(note)}
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {atCap ? (
            <p className="text-sm text-slate">
              {t.notesDialog.maxReached.replace("{max}", String(MAX_DELIVERY_NOTES_PER_REQUISITION))}
            </p>
          ) : adding ? (
            <DeliveryNoteUploader
              requisitionId={row.id}
              onUploaded={handleUploaded}
              onCancel={() => setAdding(false)}
              cancelLabel={t.deleteDialog.cancel}
            />
          ) : (
            <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
              {t.notesDialog.addAnother}
            </Button>
          )}
        </div>
      </Dialog>

      <DeleteDeliveryNoteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirmed()}
        fileName={deleteTarget?.originalFilename ?? ""}
        lastNotePrNumber={notes.length === 1 ? row.prNumber : null}
        loading={deleting}
      />
    </>
  );
}
