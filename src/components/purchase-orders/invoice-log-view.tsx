"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Badge, Spinner, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import type { PurchaseOrderListRow } from "@/lib/data/purchase-orders";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { toast } from "@/store/toast-store";
import { RfqPager } from "@/components/rfq/rfq-pager";
import { RfqToolbar } from "@/components/rfq/rfq-toolbar";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { PrLinksDialog } from "./pr-links-dialog";
import { RequestInvoiceDialog } from "./request-invoice-dialog";
import { RerequestInvoiceDialog } from "./rerequest-invoice-dialog";
import { InvoiceDocumentsModal, type InvoiceDocumentItem } from "./invoice-documents-modal";

const t = en.staff.invoiceLog;
const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  [PURCHASE_ORDER_STATUS.PENDING_PO]: "amber",
  [PURCHASE_ORDER_STATUS.PO_ISSUED]: "moss",
  [PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED]: "teal",
  [PURCHASE_ORDER_STATUS.PAID]: "moss",
  [PURCHASE_ORDER_STATUS.INVOICE_REQUESTED]: "amber",
  [PURCHASE_ORDER_STATUS.INVOICE_RECEIVED]: "moss",
};

const INVOICE_LOG_STATUSES = [
  PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED,
  PURCHASE_ORDER_STATUS.PAID,
  PURCHASE_ORDER_STATUS.INVOICE_REQUESTED,
  PURCHASE_ORDER_STATUS.INVOICE_RECEIVED,
];

const INVOICE_LOG_STATUS_OPTIONS = INVOICE_LOG_STATUSES.map((value) => ({
  value,
  label: en.staff.purchaseOrders.statusLabels[value],
}));

const DEFAULT_PAGE_SIZE = 20;

type ListParams = {
  page: number;
  pageSize: number;
  search: string;
  statuses: string[];
  vessels: string[];
  categories: string[];
  proformaDatePreset: DatePreset | null;
  proformaStartDate: string | null;
  proformaEndDate: string | null;
};

type InitialFilters = {
  page: number;
  pageSize: number;
  search: string;
  statuses: string[];
  vessels: string[];
  categories: string[];
  proformaDatePreset: DatePreset | null;
  proformaStartDate: string | null;
  proformaEndDate: string | null;
};

type RequestInvoiceTarget = {
  id: string;
  vendorName: string;
  vendorEmails: string[];
};

type ViewInvoiceTarget = {
  id: string;
  docs: InvoiceDocumentItem[];
  loadError: string | null;
};

type CopyResult = { data?: { link: string }; error?: { message: string } };
type VendorsResult = { data?: { id: string; name: string; mail: string[] }[]; error?: { message: string } };
type DocsResult = { data?: InvoiceDocumentItem[]; error?: { message: string } };

export function InvoiceLogView({
  initialDropdownFields,
  initialRows,
  initialTotal,
  initialFilters,
}: {
  initialDropdownFields: PrDropdownField[];
  initialRows: PurchaseOrderListRow[];
  initialTotal: number;
  initialFilters: InitialFilters;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialFilters.page);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const [linksTarget, setLinksTarget] = useState<PurchaseOrderListRow | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<PurchaseOrderListRow | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [rerequestTarget, setRerequestTarget] = useState<PurchaseOrderListRow | null>(null);
  const [rerequesting, setRerequesting] = useState(false);
  const [requestInvoiceTarget, setRequestInvoiceTarget] = useState<RequestInvoiceTarget | null>(null);
  const [viewInvoiceTarget, setViewInvoiceTarget] = useState<ViewInvoiceTarget | null>(null);
  const [copyingLinkId, setCopyingLinkId] = useState<string | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const [appliedSearch, setAppliedSearch] = useState(initialFilters.search);
  const [appliedStatuses, setAppliedStatuses] = useState<string[]>(initialFilters.statuses);
  const [appliedVessels, setAppliedVessels] = useState<string[]>(initialFilters.vessels);
  const [appliedCategories, setAppliedCategories] = useState<string[]>(initialFilters.categories);
  const [appliedProformaDatePreset, setAppliedProformaDatePreset] = useState<DatePreset | null>(initialFilters.proformaDatePreset);
  const [appliedProformaStartDate, setAppliedProformaStartDate] = useState<string | null>(initialFilters.proformaStartDate);
  const [appliedProformaEndDate, setAppliedProformaEndDate] = useState<string | null>(initialFilters.proformaEndDate);
  const [toolbarResetKey, setToolbarResetKey] = useState(0);

  const router = useRouter();
  const pathname = usePathname();

  function updateUrl(params: ListParams) {
    const query = new URLSearchParams();
    if (params.page !== 1) query.set("page", String(params.page));
    if (params.pageSize !== DEFAULT_PAGE_SIZE) query.set("pageSize", String(params.pageSize));
    if (params.search) query.set("q", params.search);
    if (params.statuses.length) query.set("status", params.statuses.join(","));
    if (params.vessels.length) query.set("vessel", params.vessels.join(","));
    if (params.categories.length) query.set("category", params.categories.join(","));
    if (params.proformaDatePreset) {
      query.set("proformaDatePreset", params.proformaDatePreset);
      if (params.proformaStartDate) query.set("proformaDateFrom", params.proformaStartDate);
      if (params.proformaEndDate) query.set("proformaDateTo", params.proformaEndDate);
    }
    const qs = query.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  const appliedParams = {
    search: appliedSearch,
    statuses: appliedStatuses,
    vessels: appliedVessels,
    categories: appliedCategories,
    proformaDatePreset: appliedProformaDatePreset,
    proformaStartDate: appliedProformaStartDate,
    proformaEndDate: appliedProformaEndDate,
  };

  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedStatuses.length > 0 ||
    appliedVessels.length > 0 ||
    appliedCategories.length > 0 ||
    appliedProformaDatePreset !== null;

  // When no status filter is applied, lock to the invoice-log statuses so
  // pending_po / po_issued rows never appear here regardless of filter state.
  function resolveStatusParam(selected: string[]): string {
    return (selected.length > 0 ? selected : INVOICE_LOG_STATUSES).join(",");
  }

  async function fetchList(params: ListParams) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
        status: resolveStatusParam(params.statuses),
      });
      if (params.search) query.set("search", params.search);
      if (params.vessels.length) query.set("vessel", params.vessels.join(","));
      if (params.categories.length) query.set("category", params.categories.join(","));
      if (params.proformaDatePreset) query.set("proformaDatePreset", params.proformaDatePreset);
      if (params.proformaStartDate) query.set("proformaDateFrom", params.proformaStartDate);
      if (params.proformaEndDate) query.set("proformaDateTo", params.proformaEndDate);

      const response = await fetch(`/api/purchase-orders?${query.toString()}`);
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.loadError);
        return;
      }

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
      setAppliedProformaDatePreset(params.proformaDatePreset);
      setAppliedProformaStartDate(params.proformaStartDate);
      setAppliedProformaEndDate(params.proformaEndDate);
      updateUrl(params);
    } catch {
      if (requestId === requestIdRef.current) toast.error(t.loadError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function handleSearchSettled(search: string) {
    void fetchList({ page: 1, pageSize, ...appliedParams, search });
  }

  // The toolbar's datePreset/startDate/endDate are the proforma date filter here.
  function handleFilterSubmit(params: {
    search: string;
    statuses: string[];
    vessels: string[];
    categories: string[];
    datePreset: DatePreset | null;
    startDate: string | null;
    endDate: string | null;
  }) {
    void fetchList({
      page: 1,
      pageSize,
      search: params.search,
      statuses: params.statuses,
      vessels: params.vessels,
      categories: params.categories,
      proformaDatePreset: params.datePreset,
      proformaStartDate: params.startDate,
      proformaEndDate: params.endDate,
    });
  }

  function handleFilterClear() {
    setAppliedSearch("");
    setAppliedStatuses([]);
    setAppliedVessels([]);
    setAppliedCategories([]);
    setAppliedProformaDatePreset(null);
    setAppliedProformaStartDate(null);
    setAppliedProformaEndDate(null);
    setToolbarResetKey((key) => key + 1);
    void fetchList({
      page: 1,
      pageSize,
      search: "",
      statuses: [],
      vessels: [],
      categories: [],
      proformaDatePreset: null,
      proformaStartDate: null,
      proformaEndDate: null,
    });
  }

  const vesselOptions = initialDropdownFields.find((field) => field.key === "vessel")?.options ?? [];
  const categoryOptions = initialDropdownFields.find((field) => field.key === "category")?.options ?? [];

  async function handleCopyLink(row: PurchaseOrderListRow) {
    setCopyingLinkId(row.id);
    try {
      const response = await fetch(`/api/purchase-orders/${row.id}/invoice-request`);
      const payload = (await response.json().catch(() => null)) as CopyResult | null;
      if (!response.ok || !payload?.data?.link) {
        toast.error(payload?.error?.message ?? t.fetchTokenError);
        return;
      }
      await navigator.clipboard.writeText(payload.data.link);
      toast.success(t.linkCopied);
    } catch {
      toast.error(t.linkCopyFailed);
    } finally {
      setCopyingLinkId(null);
    }
  }

  async function handleViewInvoice(row: PurchaseOrderListRow) {
    setLoadingInvoiceId(row.id);
    try {
      const response = await fetch(`/api/purchase-orders/${row.id}/invoice-documents`);
      const payload = (await response.json().catch(() => null)) as DocsResult | null;
      if (!response.ok || !payload) {
        setViewInvoiceTarget({
          id: row.id,
          docs: [],
          loadError: payload?.error?.message ?? t.invoiceDocumentsModal.loadError,
        });
        return;
      }
      setViewInvoiceTarget({ id: row.id, docs: payload.data ?? [], loadError: null });
    } catch {
      setViewInvoiceTarget({ id: row.id, docs: [], loadError: t.invoiceDocumentsModal.loadError });
    } finally {
      setLoadingInvoiceId(null);
    }
  }

  async function handleOpenRequestInvoice(row: PurchaseOrderListRow) {
    let emails: string[] = [];
    try {
      const res = await fetch("/api/vendors");
      const payload = (await res.json().catch(() => null)) as VendorsResult | null;
      const vendors = payload?.data ?? [];
      // RFQ links issued before vendor ids were stored have no vendorId; fall back
      // to the vendor with exactly this name, but only when it is unambiguous.
      const byName = vendors.filter(
        (v) => v.name.trim().toLowerCase() === row.vendorName.trim().toLowerCase(),
      );
      const vendor = row.vendorId
        ? vendors.find((v) => v.id === row.vendorId)
        : byName.length === 1
          ? byName[0]
          : undefined;
      emails = vendor?.mail ?? [];
    } catch {
      // proceed with empty list; the dialog shows an error message
    }
    setRequestInvoiceTarget({ id: row.id, vendorName: row.vendorName, vendorEmails: emails });
  }

  async function handleMarkPaidConfirmed() {
    if (!markPaidTarget) return;
    setMarkingPaid(true);
    try {
      const response = await fetch(`/api/purchase-orders/${markPaidTarget.id}/paid`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.markPaidError);
        return;
      }
      toast.success(t.markPaidDone);
      setMarkPaidTarget(null);
      void fetchList({ page, pageSize, ...appliedParams });
    } catch {
      toast.error(t.markPaidError);
    } finally {
      setMarkingPaid(false);
    }
  }

  async function handleRerequestConfirmed() {
    if (!rerequestTarget) return;
    setRerequesting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${rerequestTarget.id}/invoice-rerequest`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.rerequestInvoiceError);
        return;
      }
      toast.success(t.rerequestInvoiceDone);
      setRerequestTarget(null);
      void fetchList({ page, pageSize, ...appliedParams });
    } catch {
      toast.error(t.rerequestInvoiceError);
    } finally {
      setRerequesting(false);
    }
  }

  function handleRequestInvoiceSuccess() {
    setRequestInvoiceTarget(null);
    void fetchList({ page, pageSize, ...appliedParams });
  }

  const ctaClass =
    "rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-harbor transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
        <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
      </div>

      <RfqToolbar
        key={toolbarResetKey}
        labels={t.toolbar}
        statusOptions={INVOICE_LOG_STATUS_OPTIONS}
        vesselOptions={vesselOptions}
        categoryOptions={categoryOptions}
        appliedStatuses={appliedStatuses}
        appliedVessels={appliedVessels}
        appliedCategories={appliedCategories}
        appliedDatePreset={appliedProformaDatePreset}
        appliedStartDate={appliedProformaStartDate}
        appliedEndDate={appliedProformaEndDate}
        onSearchSettled={handleSearchSettled}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
        submitting={loading}
      />

      <section
        aria-label={t.title}
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)"
      >
        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
                  <th className="px-4 py-3">{t.columns.prRef}</th>
                  <th className="px-4 py-3">{t.columns.requisitionNumber}</th>
                  <th className="px-4 py-3">{t.columns.title}</th>
                  <th className="px-4 py-3">{t.columns.vessel}</th>
                  <th className="px-4 py-3">{t.columns.vendor}</th>
                  <th className="px-4 py-3 text-right">{t.columns.total}</th>
                  <th className="px-4 py-3">{t.columns.status}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-lt">
                      {hasActiveFilters ? t.noResults : t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-line last:border-b-0 hover:bg-mist"
                      onClick={() => setLinksTarget(row)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">
                        <button
                          type="button"
                          aria-label={t.prLinksDialog.openRowFor.replace("{prNumber}", row.prNumber)}
                          className="font-mono underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLinksTarget(row);
                          }}
                        >
                          {row.prNumber}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">
                        {row.requisitionNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-ink">{row.title ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.vesselLabel ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{row.vendorName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                        {formatCurrencyUsd(row.totalQuotedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status]}>
                          {en.staff.purchaseOrders.statusLabels[row.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/api/purchase-orders/${row.id}/proforma`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t.viewFor.replace("{prNumber}", row.prNumber)}
                            className={ctaClass}
                          >
                            {t.viewProforma}
                          </a>

                          {row.status === PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED ? (
                            <button type="button" className={ctaClass} onClick={() => setMarkPaidTarget(row)}>
                              {t.markPaid}
                            </button>
                          ) : row.status === PURCHASE_ORDER_STATUS.PAID ? (
                            <button
                              type="button"
                              className={ctaClass}
                              onClick={() => void handleOpenRequestInvoice(row)}
                            >
                              {t.requestInvoice}
                            </button>
                          ) : row.status === PURCHASE_ORDER_STATUS.INVOICE_REQUESTED ? (
                            <button
                              type="button"
                              className={ctaClass}
                              disabled={copyingLinkId === row.id}
                              onClick={() => void handleCopyLink(row)}
                            >
                              {copyingLinkId === row.id ? t.copyingLink : t.copyInvoiceLink}
                            </button>
                          ) : row.status === PURCHASE_ORDER_STATUS.INVOICE_RECEIVED ? (
                            <button
                              type="button"
                              className={ctaClass}
                              disabled={loadingInvoiceId === row.id}
                              onClick={() => void handleViewInvoice(row)}
                            >
                              {loadingInvoiceId === row.id ? (
                                <span className="flex items-center gap-1.5">
                                  <Spinner size="sm" />
                                  {t.viewInvoice}
                                </span>
                              ) : (
                                t.viewInvoice
                              )}
                            </button>
                          ) : null}

                          {row.status === PURCHASE_ORDER_STATUS.INVOICE_RECEIVED ? (
                            <button type="button" className={ctaClass} onClick={() => setRerequestTarget(row)}>
                              {t.rerequestInvoice}
                            </button>
                          ) : null}
                        </div>
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
              onPageChange={(nextPage) => void fetchList({ ...appliedParams, page: nextPage, pageSize })}
              onPageSizeChange={(nextPageSize) => void fetchList({ ...appliedParams, page: 1, pageSize: nextPageSize })}
            />
          </div>
        </div>
      </section>

      {linksTarget ? (
        <PrLinksDialog open onClose={() => setLinksTarget(null)} prNumber={linksTarget.prNumber} />
      ) : null}

      {markPaidTarget ? (
        <MarkPaidDialog
          open
          onClose={() => setMarkPaidTarget(null)}
          onConfirm={() => void handleMarkPaidConfirmed()}
          prNumber={markPaidTarget.prNumber}
          vendorName={markPaidTarget.vendorName}
          loading={markingPaid}
        />
      ) : null}

      {rerequestTarget ? (
        <RerequestInvoiceDialog
          open
          onClose={() => setRerequestTarget(null)}
          onConfirm={() => void handleRerequestConfirmed()}
          prNumber={rerequestTarget.prNumber}
          vendorName={rerequestTarget.vendorName}
          loading={rerequesting}
        />
      ) : null}

      {requestInvoiceTarget ? (
        <RequestInvoiceDialog
          open
          onClose={() => setRequestInvoiceTarget(null)}
          onSuccess={handleRequestInvoiceSuccess}
          requisitionId={requestInvoiceTarget.id}
          vendorName={requestInvoiceTarget.vendorName}
          vendorEmails={requestInvoiceTarget.vendorEmails}
        />
      ) : null}

      {viewInvoiceTarget ? (
        <InvoiceDocumentsModal
          open
          onClose={() => setViewInvoiceTarget(null)}
          requisitionId={viewInvoiceTarget.id}
          docs={viewInvoiceTarget.docs}
          loadError={viewInvoiceTarget.loadError}
        />
      ) : null}
    </div>
  );
}
