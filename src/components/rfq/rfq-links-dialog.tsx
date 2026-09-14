"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

import { Badge, Button, Checkbox, Dialog, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { MAX_COMPARE_SELECTION, RFQ_LINK_STATUS, type RfqLinkStatus } from "@/lib/constants/rfq-link";
import type { RfqLinkRow } from "@/lib/data/rfq-links";
import type { QuoteComparisonData } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { buildRfqQuotePdfFilename } from "@/lib/rfq-quote-pdf/filename";
import { toast } from "@/store/toast-store";
import { AwardConfirmDialog } from "./award-confirm-dialog";
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
  // Fired after a successful award, same in-place-refetch contract as
  // onReissued above.
  onAwarded: () => void;
};

export function RfqLinksDialog({
  open,
  onClose,
  requisitionId,
  prNumber,
  links,
  onReissued,
  onAwarded,
}: RfqLinksDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reissueTarget, setReissueTarget] = useState<RfqLinkRow | null>(null);
  const [reissueWarningTarget, setReissueWarningTarget] = useState<RfqLinkRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<QuoteComparisonData | null>(null);
  const [compareRequestedCount, setCompareRequestedCount] = useState(0);
  const [awardTarget, setAwardTarget] = useState<{ id: string; vendorName: string } | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Only one vendor can ever be awarded per requisition — once true, every
  // row's Award button disappears (nothing left to award) and every row's
  // Reissue button disappears too (award_purchase_requisition's own guard
  // already refuses reissue_rfq_link post-award, so hiding it here just
  // avoids offering a button that would 409 — see plans/development.md §18).
  const anyAwarded = links.some((link) => link.isAwarded);

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

  async function handleAwardConfirmed() {
    if (!awardTarget) return;
    setAwarding(true);
    try {
      const response = await fetch(`/api/purchase-requisitions/${requisitionId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfqLinkId: awardTarget.id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.awardError);
        return;
      }

      toast.success(t.awardSuccess.replace("{vendorName}", awardTarget.vendorName));
      // Patches the already-open Compare modal in place, if it's open — its
      // own data isn't part of the onAwarded() refetch below (that only
      // refreshes this dialog's own `links` prop upstream), and nothing else
      // about a comparison changes just because a vendor was awarded.
      setCompareData((current) => (current ? { ...current, awardedLinkId: awardTarget.id } : current));
      setAwardTarget(null);
      onAwarded();
    } catch {
      toast.error(t.awardError);
    } finally {
      setAwarding(false);
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

  // Same fetch -> blob -> synthetic <a download> click pattern
  // po-requests-view.tsx's own handleExport already uses for the Excel
  // export — no toast.success, the download itself is the success signal.
  async function handleExportPdf(row: RfqLinkRow) {
    setExportingId(row.id);
    try {
      const response = await fetch(`/api/purchase-requisitions/${requisitionId}/rfq-links/${row.id}/export`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error?.message ?? t.exportPdfError);
        return;
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? buildRfqQuotePdfFilename(prNumber, row.vendorName);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t.exportPdfError);
    } finally {
      setExportingId(null);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="xl"
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
                <th className={headerCellClass}>{t.columns.grandTotal}</th>
                <th className={headerCellClass}>{t.columns.deliveryTerms}</th>
                <th className={headerCellClass}>{t.columns.maxDeliveryLeadTime}</th>
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
                  <td className={`${cellClass} font-mono text-ink`}>{formatCurrencyUsd(row.grandTotal)}</td>
                  <td className={cellClass}>{row.deliveryTerms ?? "—"}</td>
                  <td className={`${cellClass} font-mono text-slate`}>{row.maxDeliveryLeadTimeDays ?? "—"}</td>
                  <td className={cellClass}>
                    {row.isAwarded ? (
                      <Badge tone="moss">{t.awardedBadge}</Badge>
                    ) : (
                      <Badge tone={STATUS_TONE[row.status]}>{t.statusLabels[row.status]}</Badge>
                    )}
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
                      {row.status === RFQ_LINK_STATUS.QUOTE_RECEIVED && !anyAwarded ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setAwardTarget({ id: row.id, vendorName: row.vendorName })}
                        >
                          {t.award}
                        </Button>
                      ) : null}
                      {row.status !== RFQ_LINK_STATUS.PENDING && !anyAwarded ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleReissueClick(row)}>
                          {t.reissue}
                        </Button>
                      ) : null}
                      {row.status === RFQ_LINK_STATUS.QUOTE_RECEIVED ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={exportingId === row.id}
                          onClick={() => handleExportPdf(row)}
                        >
                          <Download size={13} strokeWidth={2} />
                          {t.exportPdf}
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
        onAwardClick={(vendor) => setAwardTarget({ id: vendor.linkId, vendorName: vendor.vendorName })}
      />

      <AwardConfirmDialog
        open={awardTarget !== null}
        onClose={() => setAwardTarget(null)}
        onConfirm={handleAwardConfirmed}
        vendorName={awardTarget?.vendorName ?? ""}
        prNumber={prNumber}
        loading={awarding}
      />
    </>
  );
}
