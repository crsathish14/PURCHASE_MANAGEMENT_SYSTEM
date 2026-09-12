"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Badge, Button, Checkbox, Dialog, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { MAX_COMPARE_SELECTION, RFQ_LINK_STATUS, type RfqLinkStatus } from "@/lib/constants/rfq-link";
import type { RfqLinkRow } from "@/lib/data/rfq-links";
import type { QuoteComparisonData } from "@/lib/data/rfq-quote-comparison";
import { toast } from "@/store/toast-store";
import { CompareQuotesModal } from "./compare-quotes-modal";
import { ReissueRfqDialog } from "./reissue-rfq-dialog";
import { ReissueWarningDialog } from "./reissue-warning-dialog";

const t = en.staff.requestedQuote.linksDialog;

const STATUS_TONE: Record<RfqLinkStatus, BadgeTone> = {
  [RFQ_LINK_STATUS.PENDING]: "amber",
  [RFQ_LINK_STATUS.QUOTE_RECEIVED]: "moss",
  [RFQ_LINK_STATUS.EXPIRED]: "rust",
};

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";

export type RfqLinksDialogProps = {
  open: boolean;
  onClose: () => void;
  requisitionId: string;
  prNumber: string;
  // Fetched by the parent before this dialog ever opens (same
  // fetch-then-open pattern purchase-requisition/po-requests-view.tsx
  // already uses for CreateRequisitionDialog's own `requisition` prop) —
  // this component is purely presentational, no data-fetching of its own.
  links: RfqLinkRow[];
  // Fired after a successful reissue so the parent can refetch this same
  // list in place, without closing/reopening the dialog.
  onReissued: () => void;
};

export function RfqLinksDialog({ open, onClose, requisitionId, prNumber, links, onReissued }: RfqLinksDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reissueTarget, setReissueTarget] = useState<RfqLinkRow | null>(null);
  const [reissueWarningTarget, setReissueWarningTarget] = useState<RfqLinkRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<QuoteComparisonData | null>(null);
  const [compareRequestedCount, setCompareRequestedCount] = useState(0);

  function handleReissueClick(row: RfqLinkRow) {
    if (row.status === RFQ_LINK_STATUS.QUOTE_RECEIVED) {
      setReissueWarningTarget(row);
      return;
    }
    setReissueTarget(row);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      if (current.length >= MAX_COMPARE_SELECTION) return current;
      return [...current, id];
    });
  }

  async function handleCompare() {
    setCompareLoading(true);
    try {
      const response = await fetch(
        `/api/purchase-requisitions/${requisitionId}/rfq-links/compare?linkIds=${selectedIds.join(",")}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.compareLoadError);
        return;
      }

      setCompareData(payload.data);
      setCompareRequestedCount(selectedIds.length);
      setCompareOpen(true);
    } catch {
      toast.error(t.compareLoadError);
    } finally {
      setCompareLoading(false);
    }
  }

  async function copyLink(row: RfqLinkRow) {
    try {
      await navigator.clipboard.writeText(row.link);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((current) => (current === row.id ? null : current)), 1500);
    } catch {
      // Clipboard access can be denied by the browser — the link is still
      // visible/selectable in its own row either way.
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title={t.title.replace("{prNumber}", prNumber)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t.close}
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0}
              loading={compareLoading}
              onClick={handleCompare}
            >
              {t.compareQuote}
            </Button>
          </div>
        }
      >
        {links.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-lt">{t.empty}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={headerCellClass} aria-hidden="true">
                  {t.columns.select}
                </th>
                <th className={headerCellClass}>{t.columns.vendor}</th>
                <th className={headerCellClass}>{t.columns.issued}</th>
                <th className={headerCellClass}>{t.columns.received}</th>
                <th className={headerCellClass}>{t.columns.status}</th>
                <th className={headerCellClass} aria-hidden="true">
                  {t.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {links.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <td className={cellClass}>
                    <Checkbox
                      aria-label={t.columns.select}
                      checked={selectedIds.includes(row.id)}
                      disabled={
                        row.status !== RFQ_LINK_STATUS.QUOTE_RECEIVED ||
                        (!selectedIds.includes(row.id) && selectedIds.length >= MAX_COMPARE_SELECTION)
                      }
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>
                  <td className={cellClass}>
                    <div className="text-ink">{row.vendorName}</div>
                    <div className="text-[11px] text-slate-lt">{row.vendorEmail}</div>
                  </td>
                  <td className={`${cellClass} font-mono text-slate`}>{dateFormatter.format(new Date(row.issuedAt))}</td>
                  <td className={`${cellClass} font-mono text-slate`}>
                    {row.receivedAt ? dateFormatter.format(new Date(row.receivedAt)) : "—"}
                  </td>
                  <td className={cellClass}>
                    <Badge tone={STATUS_TONE[row.status]}>{t.statusLabels[row.status]}</Badge>
                  </td>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    <div className="flex items-center gap-1.5">
                      {row.status === RFQ_LINK_STATUS.PENDING ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => copyLink(row)}>
                          {copiedId === row.id ? (
                            <Check size={13} strokeWidth={2} />
                          ) : (
                            <Copy size={13} strokeWidth={2} />
                          )}
                          {copiedId === row.id ? t.copied : t.copyLink}
                        </Button>
                      ) : null}
                      {row.status !== RFQ_LINK_STATUS.PENDING ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleReissueClick(row)}>
                          {t.reissue}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Dialog>

      <ReissueWarningDialog
        open={reissueWarningTarget !== null}
        onClose={() => setReissueWarningTarget(null)}
        vendorName={reissueWarningTarget?.vendorName ?? ""}
        onConfirm={() => {
          setReissueTarget(reissueWarningTarget);
          setReissueWarningTarget(null);
        }}
      />

      <ReissueRfqDialog
        key={reissueTarget?.id ?? "closed"}
        open={reissueTarget !== null}
        onClose={() => setReissueTarget(null)}
        requisitionId={requisitionId}
        linkId={reissueTarget?.id ?? ""}
        vendorName={reissueTarget?.vendorName ?? ""}
        vendorEmail={reissueTarget?.vendorEmail ?? ""}
        onReissued={() => {
          setReissueTarget(null);
          onReissued();
        }}
      />

      <CompareQuotesModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        data={compareData}
        requestedCount={compareRequestedCount}
      />
    </>
  );
}
