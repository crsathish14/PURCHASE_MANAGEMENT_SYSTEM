"use client";

import { useRef, useState } from "react";

import { Badge, Button, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_CATEGORY, type DatePreset } from "@/lib/constants/purchase-requisition";
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import type { PurchaseOrderListRow } from "@/lib/data/purchase-orders";
import type { QuoteComparisonData } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { buildPurchaseOrderPdfFilename } from "@/lib/purchase-order-pdf/filename";
import { toast } from "@/store/toast-store";
import {
  isValidNeededPoQty,
  type PurchaseOrderQuantityEditor,
} from "@/components/purchase-orders/purchase-order-quantity-editor";
import { RfqPager } from "@/components/rfq/rfq-pager";
import { RfqToolbar } from "@/components/rfq/rfq-toolbar";
import { CompareQuotesModal } from "@/components/rfq/compare-quotes-modal";
import { IssuePurchaseOrderDialog } from "@/components/purchase-orders/issue-purchase-order-dialog";

const t = en.staff.purchaseOrders;
const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  [PURCHASE_ORDER_STATUS.PENDING_PO]: "amber",
  [PURCHASE_ORDER_STATUS.PO_ISSUED]: "moss",
  [PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED]: "teal",
};
const STATUS_OPTIONS = Object.values(PURCHASE_ORDER_STATUS).map((value) => ({
  value,
  label: t.statusLabels[value],
}));
const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

function isIssuedStatus(status: PurchaseOrderStatus | undefined): boolean {
  return status === PURCHASE_ORDER_STATUS.PO_ISSUED || status === PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED;
}

type ListParams = {
  page: number;
  pageSize: number;
  search: string;
  statuses: string[];
  vessels: string[];
  categories: string[];
  datePreset: DatePreset | null;
  startDate: string | null;
  endDate: string | null;
};

const DEFAULT_PAGE_SIZE = 20;

export function PurchaseOrdersView({
  initialDropdownFields,
  initialRows,
  initialTotal,
}: {
  initialDropdownFields: PrDropdownField[];
  initialRows: PurchaseOrderListRow[];
  initialTotal: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [quoteDetail, setQuoteDetail] = useState<QuoteComparisonData | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [neededPoQuantities, setNeededPoQuantities] = useState<Record<string, string>>({});
  const [sameAsQuoteQty, setSameAsQuoteQty] = useState(true);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingPoPdf, setDownloadingPoPdf] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [issuedRequisitionIds, setIssuedRequisitionIds] = useState<Set<string>>(() => new Set());

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatuses, setAppliedStatuses] = useState<string[]>([]);
  const [appliedVessels, setAppliedVessels] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [appliedDatePreset, setAppliedDatePreset] = useState<DatePreset | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState<string | null>(null);
  const [appliedEndDate, setAppliedEndDate] = useState<string | null>(null);
  const [toolbarResetKey, setToolbarResetKey] = useState(0);
  const requestIdRef = useRef(0);

  const appliedParams = {
    search: appliedSearch,
    statuses: appliedStatuses,
    vessels: appliedVessels,
    categories: appliedCategories,
    datePreset: appliedDatePreset,
    startDate: appliedStartDate,
    endDate: appliedEndDate,
  };
  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedStatuses.length > 0 ||
    appliedVessels.length > 0 ||
    appliedCategories.length > 0 ||
    appliedDatePreset !== null;

  async function fetchList(params: ListParams) {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
      if (params.search) query.set("search", params.search);
      if (params.statuses.length) query.set("status", params.statuses.join(","));
      if (params.vessels.length) query.set("vessel", params.vessels.join(","));
      if (params.categories.length) query.set("category", params.categories.join(","));
      if (params.datePreset) query.set("datePreset", params.datePreset);
      if (params.startDate) query.set("dateFrom", params.startDate);
      if (params.endDate) query.set("dateTo", params.endDate);

      const response = await fetch(`/api/purchase-orders?${query.toString()}`);
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.loadError);
        return;
      }

      // The RPC includes total_count on result rows. If a filter shrinks the
      // result set while on a later page, retry page one to recover the count.
      if (payload.data.length === 0 && params.page > 1) {
        await fetchList({ ...params, page: 1 });
        return;
      }

      setRows(payload.data);
      setTotal(payload.meta.total);
      setPage(params.page);
      setPageSize(params.pageSize);
      setAppliedSearch(params.search);
      setAppliedStatuses(params.statuses);
      setAppliedVessels(params.vessels);
      setAppliedCategories(params.categories);
      setAppliedDatePreset(params.datePreset);
      setAppliedStartDate(params.startDate);
      setAppliedEndDate(params.endDate);
    } catch {
      if (requestId === requestIdRef.current) toast.error(t.loadError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function handleSearchSettled(search: string) {
    fetchList({ page: 1, pageSize, ...appliedParams, search });
  }

  function handleFilterSubmit(params: Omit<ListParams, "page" | "pageSize">) {
    fetchList({ page: 1, pageSize, ...params });
  }

  function handleFilterClear() {
    setAppliedSearch("");
    setAppliedStatuses([]);
    setAppliedVessels([]);
    setAppliedCategories([]);
    setAppliedDatePreset(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setToolbarResetKey((key) => key + 1);
    fetchList({
      page: 1,
      pageSize,
      search: "",
      statuses: [],
      vessels: [],
      categories: [],
      datePreset: null,
      startDate: null,
      endDate: null,
    });
  }

  const vesselOptions = initialDropdownFields.find((field) => field.key === "vessel")?.options ?? [];
  const categoryOptions = initialDropdownFields.find((field) => field.key === "category")?.options ?? [];

  async function handleRowSelect(row: PurchaseOrderListRow) {
    setDetailLoadingId(row.id);
    setIssuedLink(null);
    try {
      const response = await fetch(`/api/purchase-requisitions/${row.id}/rfq-links/compare`);
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.detailLoadError);
        return;
      }

      const detail = payload.data as QuoteComparisonData;
      if (row.status === PURCHASE_ORDER_STATUS.PO_ISSUED) {
        try {
          const issuedLinkResponse = await fetch(`/api/purchase-orders/${row.id}/issue`);
          const issuedLinkPayload = await issuedLinkResponse.json();
          if (!issuedLinkResponse.ok) {
            toast.error(issuedLinkPayload?.error?.message ?? t.issuedLinkLoadError);
          } else {
            setIssuedLink(issuedLinkPayload.data.link as string);
          }
        } catch {
          toast.error(t.issuedLinkLoadError);
        }
      }

      const awardedVendor = detail.vendors[0];
      setNeededPoQuantities(
        Object.fromEntries(
          (awardedVendor?.lineItems ?? []).map((item) => [
            item.quotationItemId,
            item.neededPoQty ?? item.approvedQty ?? "",
          ]),
        ),
      );
      setSameAsQuoteQty(
        detail.purchaseOrderDraft?.sameAsQuoteQty ?? detail.category !== PR_CATEGORY.SERVICE,
      );
      setValidationAttempted(false);
      setQuoteDetail(detail);
    } catch {
      toast.error(t.detailLoadError);
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function handleCopyIssuedLink() {
    if (!issuedLink) {
      toast.error(t.issuedLinkLoadError);
      return;
    }

    try {
      await navigator.clipboard.writeText(issuedLink);
      toast.success(t.linkCopied);
    } catch {
      toast.error(t.linkCopyError);
    }
  }

  function handleSameAsQuoteQtyChange(checked: boolean) {
    setSameAsQuoteQty(checked);
    if (checked && quoteDetail?.vendors[0]) {
      setNeededPoQuantities(
        Object.fromEntries(
          quoteDetail.vendors[0].lineItems.map((item) => [item.quotationItemId, item.approvedQty ?? ""]),
        ),
      );
    }
  }

  function handleNeededPoQtyChange(quotationItemId: string, value: string) {
    setNeededPoQuantities((current) => ({ ...current, [quotationItemId]: value }));
    setSameAsQuoteQty(false);
  }

  async function handleSaveDraft() {
    const vendor = quoteDetail?.vendors[0];
    const row = rows.find((item) => item.id === quoteDetail?.requisitionId);
    if (!quoteDetail || !vendor || isIssuedStatus(row?.status)) return;

    const hasQuantityFields =
      quoteDetail.category === PR_CATEGORY.STORES ||
      quoteDetail.category === PR_CATEGORY.SPARES ||
      quoteDetail.category === PR_CATEGORY.LO;
    if (
      hasQuantityFields &&
      vendor.lineItems.some((item) => !isValidNeededPoQty(neededPoQuantities[item.quotationItemId] ?? ""))
    ) {
      setValidationAttempted(true);
      toast.error(t.invalidDraft);
      return;
    }

    setSavingDraft(true);
    try {
      const response = await fetch(`/api/purchase-orders/${quoteDetail.requisitionId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sameAsQuoteQty: hasQuantityFields ? sameAsQuoteQty : false,
          items: hasQuantityFields
            ? vendor.lineItems.map((item) => ({
                quotationItemId: item.quotationItemId,
                neededPoQty: Number(neededPoQuantities[item.quotationItemId]),
              }))
            : [],
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.draftSaveError);
        return;
      }

      setQuoteDetail((current) => {
        if (!current) return current;
        return {
          ...current,
          purchaseOrderDraft: { id: payload.data.id, sameAsQuoteQty: hasQuantityFields && sameAsQuoteQty },
          vendors: current.vendors.map((currentVendor) =>
            currentVendor.quotationId !== vendor.quotationId
              ? currentVendor
              : {
                  ...currentVendor,
                  lineItems: currentVendor.lineItems.map((item) => ({
                    ...item,
                    neededPoQty: hasQuantityFields
                      ? neededPoQuantities[item.quotationItemId] ?? item.approvedQty
                      : null,
                  })),
                },
          ),
        };
      });
      setValidationAttempted(false);
      toast.success(t.draftSaved);
    } catch {
      toast.error(t.draftSaveError);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDownloadPurchaseOrderPdf() {
    if (!quoteDetail) return;

    setDownloadingPoPdf(true);
    try {
      const response = await fetch(`/api/purchase-orders/${quoteDetail.requisitionId}/export`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error?.message ?? t.downloadPdfError);
        return;
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? buildPurchaseOrderPdfFilename(quoteDetail.prNumber);
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
      toast.error(t.downloadPdfError);
    } finally {
      setDownloadingPoPdf(false);
    }
  }

  const hasQuantityFields =
    quoteDetail?.category === PR_CATEGORY.STORES ||
    quoteDetail?.category === PR_CATEGORY.SPARES ||
    quoteDetail?.category === PR_CATEGORY.LO;
  const selectedRow = rows.find((row) => row.id === quoteDetail?.requisitionId);
  const isIssued =
    Boolean(quoteDetail && issuedRequisitionIds.has(quoteDetail.requisitionId)) ||
    isIssuedStatus(selectedRow?.status);
  const proformaReceived = selectedRow?.status === PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED;
  const purchaseOrderEditor: PurchaseOrderQuantityEditor | undefined = hasQuantityFields
    ? {
        quantities: neededPoQuantities,
        sameAsQuoteQty,
        validationAttempted,
        disabled: isIssued,
        onSameAsQuoteQtyChange: handleSameAsQuoteQtyChange,
        onQuantityChange: handleNeededPoQtyChange,
      }
    : undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
        <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
      </div>

      <section
        aria-label={t.title}
        aria-busy={loading || detailLoadingId !== null}
        className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)"
      >
        <div className="p-4 pb-0">
          <RfqToolbar
            key={toolbarResetKey}
            labels={t.toolbar}
            statusOptions={STATUS_OPTIONS}
            vesselOptions={vesselOptions}
            categoryOptions={categoryOptions}
            appliedStatuses={appliedStatuses}
            appliedVessels={appliedVessels}
            appliedCategories={appliedCategories}
            appliedDatePreset={appliedDatePreset}
            appliedStartDate={appliedStartDate}
            appliedEndDate={appliedEndDate}
            onSearchSettled={handleSearchSettled}
            onSubmit={handleFilterSubmit}
            onClear={handleFilterClear}
            submitting={loading}
          />
        </div>

        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-260 text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
                  <th className="px-4 py-3">{t.columns.prRef}</th>
                  <th className="px-4 py-3">{t.columns.requisitionNumber}</th>
                  <th className="px-4 py-3">{t.columns.title}</th>
                  <th className="px-4 py-3">{t.columns.vessel}</th>
                  <th className="px-4 py-3">{t.columns.vendor}</th>
                  <th className="px-4 py-3">{t.columns.quoteRef}</th>
                  <th className="px-4 py-3 text-right">{t.columns.total}</th>
                  <th className="px-4 py-3">{t.columns.quoteDate}</th>
                  <th className="px-4 py-3">{t.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-lt">
                      {total === 0 && !hasActiveFilters ? t.empty : t.noResults}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      aria-label={t.viewQuoteFor.replace("{prNumber}", row.prNumber)}
                      onClick={() => {
                        if (!detailLoadingId) void handleRowSelect(row);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (!detailLoadingId) void handleRowSelect(row);
                        }
                      }}
                      className={`border-b border-line last:border-b-0 hover:bg-mist focus-visible:outline-2 focus-visible:outline-harbor ${
                        detailLoadingId === row.id ? "cursor-wait opacity-60" : "cursor-pointer"
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{row.prNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{row.requisitionNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.title ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.vesselLabel ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{row.vendorName}</td>
                      <td className="px-4 py-3 font-mono text-slate">{row.quoteReference ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                        {formatCurrencyUsd(row.totalQuotedAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate">
                        {dateFormatter.format(new Date(row.quoteSubmittedAt))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status]}>{t.statusLabels[row.status]}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line">
            <RfqPager
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage) => fetchList({ page: nextPage, pageSize, ...appliedParams })}
              onPageSizeChange={(nextPageSize) => fetchList({ page: 1, pageSize: nextPageSize, ...appliedParams })}
            />
          </div>
        </div>
      </section>

      <CompareQuotesModal
        open={quoteDetail !== null}
        onClose={() => {
          setQuoteDetail(null);
          setValidationAttempted(false);
        }}
        data={quoteDetail}
        requestedCount={1}
        title={t.quoteDetailTitle}
        purchaseOrderEditor={purchaseOrderEditor}
        footer={
          quoteDetail ? (
            isIssued ? (
              <>
                {!proformaReceived ? (
                  <Button type="button" onClick={() => void handleCopyIssuedLink()} disabled={!issuedLink}>
                    {t.copyUrl}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={downloadingPoPdf}
                  loading={downloadingPoPdf}
                  onClick={() => void handleDownloadPurchaseOrderPdf()}
                >
                  {t.download}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" onClick={() => void handleSaveDraft()} loading={savingDraft}>
                  {t.saveDraft}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setIssueDialogOpen(true)}>
                  {t.issuePo}
                </Button>
              </>
            )
          ) : null
        }
        onAwardClick={() => undefined}
      />
      {issueDialogOpen && quoteDetail?.vendors[0] ? (
        <IssuePurchaseOrderDialog
          open={issueDialogOpen}
          onClose={() => setIssueDialogOpen(false)}
          requisitionId={quoteDetail.requisitionId}
          prNumber={quoteDetail.prNumber}
          category={quoteDetail.category}
          vesselName={quoteDetail.vesselLabel}
          vesselImoNo={quoteDetail.vesselImoNo}
          vesselMasterOwners={quoteDetail.vesselMasterOwners}
          vesselCompanyName={quoteDetail.vesselCompanyName}
          vesselAddress={quoteDetail.vesselAddress}
          vendor={quoteDetail.vendors[0]}
          quantities={neededPoQuantities}
          sameAsQuoteQty={sameAsQuoteQty}
          onIssued={(link) => {
            setIssuedLink(link);
            setIssuedRequisitionIds((current) => new Set(current).add(quoteDetail.requisitionId));
            setRows((current) =>
              current.map((row) =>
                row.id === quoteDetail.requisitionId ? { ...row, status: PURCHASE_ORDER_STATUS.PO_ISSUED } : row,
              ),
            );
            void fetchList({ page, pageSize, ...appliedParams });
          }}
        />
      ) : null}
    </div>
  );
}
