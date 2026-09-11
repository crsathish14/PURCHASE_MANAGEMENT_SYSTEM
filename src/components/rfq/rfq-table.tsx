"use client";

import { Badge, Button, QuoteProgress, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { REQUESTED_QUOTE_STATUS, type RequestedQuoteStatus } from "@/lib/constants/requested-quote";
import type { RequestedQuoteListRow } from "@/lib/data/requested-quotes";

const t = en.staff.requestedQuote;

const STATUS_TONE: Record<RequestedQuoteStatus, BadgeTone> = {
  [REQUESTED_QUOTE_STATUS.RFQ_ISSUED]: "amber",
  [REQUESTED_QUOTE_STATUS.PARTIAL_RECEIVED]: "teal",
  [REQUESTED_QUOTE_STATUS.ALL_RECEIVED]: "moss",
};

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

export type RfqTableProps = {
  rows: RequestedQuoteListRow[];
  onRowSelect: (row: RequestedQuoteListRow) => void;
  detailLoadingId: string | null;
};

export function RfqTable({ rows, onRowSelect, detailLoadingId }: RfqTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
      <table className="w-full min-w-160 text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
            <th className="px-4 py-3">{t.table.columns.ref}</th>
            <th className="px-4 py-3">{t.table.columns.vessel}</th>
            <th className="px-4 py-3">{t.table.columns.quotes}</th>
            <th className="px-4 py-3">{t.table.columns.status}</th>
            <th className="px-4 py-3">{t.table.columns.firstIssuedDate}</th>
            <th className="px-4 py-3">{t.table.columns.compareQuote}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
              <td className="px-4 py-3">
                <QuoteProgress
                  received={row.quoteCount}
                  total={row.vendorCount}
                  suffixLabel={t.table.quotesOfTotalSuffix.replace("{total}", String(row.vendorCount))}
                />
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[row.derivedStatus]}>{t.table.statusLabels[row.derivedStatus]}</Badge>
              </td>
              <td className="px-4 py-3 font-mono text-slate">{dateFormatter.format(new Date(row.firstIssuedAt))}</td>
              <td className="px-4 py-3">
                {row.quoteCount === 0 ? null : (
                  <Button variant="secondary" size="sm" disabled>
                    {t.table.columns.compareQuote}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
