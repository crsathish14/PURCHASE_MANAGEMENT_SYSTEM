"use client";

import { Badge, Menu, MenuItem, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_PRIORITY, PR_STATUS, type PrPriority, type PrStatus } from "@/lib/constants/purchase-requisition";
import type { PrListRow } from "@/lib/data/purchase-requisition";

const t = en.staff.poRequests.table;

const PRIORITY_TONE: Record<PrPriority, BadgeTone> = {
  [PR_PRIORITY.HIGH]: "rust",
  [PR_PRIORITY.MEDIUM]: "amber",
  [PR_PRIORITY.LOW]: "slate",
};

const STATUS_TONE: Record<PrStatus, BadgeTone> = {
  [PR_STATUS.PENDING_RFQ]: "amber",
  [PR_STATUS.RFQ_ISSUED]: "teal",
  [PR_STATUS.QUOTES_RECEIVED]: "teal",
  [PR_STATUS.AWARDED]: "moss",
  [PR_STATUS.CANCELLED]: "rust",
};

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

function formatItemCount(count: number): string {
  const template = count === 1 ? t.itemCountSingular : t.itemCountPlural;
  return template.replace("{count}", String(count));
}

export type PrTableProps = {
  rows: PrListRow[];
  onRowSelect: (row: PrListRow) => void;
  detailLoadingId: string | null;
  onCancelRequested: (row: PrListRow) => void;
  onDeleteRequested: (row: PrListRow) => void;
  onDuplicate: (row: PrListRow) => void;
  duplicatingId: string | null;
};

export function PrTable({
  rows,
  onRowSelect,
  detailLoadingId,
  onCancelRequested,
  onDeleteRequested,
  onDuplicate,
  duplicatingId,
}: PrTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
      <table className="w-full min-w-215 text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
            <th className="px-4 py-3">{t.columns.ref}</th>
            <th className="px-4 py-3">{t.columns.vessel}</th>
            <th className="px-4 py-3">{t.columns.department}</th>
            <th className="px-4 py-3">{t.columns.category}</th>
            <th className="px-4 py-3">{t.columns.description}</th>
            <th className="px-4 py-3">{t.columns.priority}</th>
            <th className="px-4 py-3">{t.columns.requester}</th>
            <th className="px-4 py-3">{t.columns.date}</th>
            <th className="px-4 py-3">{t.columns.status}</th>
            <th className="px-4 py-3" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cancelDisabled = row.status === PR_STATUS.AWARDED || row.status === PR_STATUS.CANCELLED;
            const deleteDisabled = row.status !== PR_STATUS.PENDING_RFQ;
            return (
              <tr
                key={row.id}
                onClick={() => {
                  if (detailLoadingId) return;
                  onRowSelect(row);
                }}
                className={`border-b border-line last:border-b-0 hover:bg-mist ${
                  detailLoadingId === row.id ? "cursor-wait opacity-60" : "cursor-pointer"
                }`}
              >
                <td className="px-4 py-3 font-mono text-ink">
                  {row.prNumber}
                  {row.requisitionNumber ? (
                    <span className="ml-1.5 font-sans text-[11px] font-normal text-slate-lt">
                      {row.requisitionNumber}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink">{row.vesselLabel ?? "—"}</td>
                <td className="px-4 py-3 text-ink">{row.departmentLabel ?? "—"}</td>
                <td className="px-4 py-3 text-ink">{row.categoryLabel ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{formatItemCount(row.itemCount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={PRIORITY_TONE[row.priority]} dot={false}>
                    {priorityLabel(row.priority)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink">{row.requesterName ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-slate">{dateFormatter.format(new Date(row.createdAt))}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[row.status]}>{statusLabel(row.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Menu
                    align="right"
                    trigger={
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        aria-label={t.rowMenuLabel}
                        className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-slate-lt hover:bg-mist hover:text-ink"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.75 w-3.75" aria-hidden="true">
                          <circle cx="12" cy="5" r="1.3" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.3" fill="currentColor" />
                        </svg>
                      </button>
                    }
                  >
                    <MenuItem tone="danger" disabled={cancelDisabled} onClick={() => onCancelRequested(row)}>
                      {t.rowMenu.cancel}
                    </MenuItem>
                    <MenuItem disabled={duplicatingId === row.id} onClick={() => onDuplicate(row)}>
                      {t.rowMenu.duplicate}
                    </MenuItem>
                    <MenuItem disabled>{t.rowMenu.issueRfq}</MenuItem>
                    <MenuItem disabled>{t.rowMenu.export}</MenuItem>
                    <div className="my-1 border-t border-line" aria-hidden="true" />
                    <MenuItem tone="danger" disabled={deleteDisabled} onClick={() => onDeleteRequested(row)}>
                      {t.rowMenu.delete}
                    </MenuItem>
                  </Menu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function priorityLabel(priority: PrPriority): string {
  const t2 = en.staff.poRequests.createDialog.priorityOptions;
  return t2[priority];
}

function statusLabel(status: PrStatus): string {
  return t.statusLabels[status];
}
