"use client";

import { Badge, type BadgeTone } from "@/components/atoms";
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
};

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

function formatItemCount(count: number): string {
  const template = count === 1 ? t.itemCountSingular : t.itemCountPlural;
  return template.replace("{count}", String(count));
}

export type PrTableProps = {
  rows: PrListRow[];
};

export function PrTable({ rows }: PrTableProps) {
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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-mist">
              <td className="px-4 py-3 font-mono text-ink">{row.prNumber}</td>
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
            </tr>
          ))}
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
