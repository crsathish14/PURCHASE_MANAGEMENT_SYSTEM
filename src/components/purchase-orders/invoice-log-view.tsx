"use client";

import { useRef, useState } from "react";

import { Badge, type BadgeTone } from "@/components/atoms";
import en from "@/locales/en.json";
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import type { PurchaseOrderListRow } from "@/lib/data/purchase-orders";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { toast } from "@/store/toast-store";
import { RfqPager } from "@/components/rfq/rfq-pager";

const t = en.staff.invoiceLog;
const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  [PURCHASE_ORDER_STATUS.PENDING_PO]: "amber",
  [PURCHASE_ORDER_STATUS.PO_ISSUED]: "moss",
  [PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED]: "teal",
};

const DEFAULT_PAGE_SIZE = 20;

export function InvoiceLogView({
  initialRows,
  initialTotal,
}: {
  initialRows: PurchaseOrderListRow[];
  initialTotal: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  async function fetchRows(nextPage: number, nextPageSize: number) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
        status: PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED,
      });
      const response = await fetch(`/api/purchase-orders?${query.toString()}`);
      const payload = await response.json();
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.loadError);
        return;
      }
      if (payload.data.length === 0 && nextPage > 1) {
        await fetchRows(1, nextPageSize);
        return;
      }
      setRows(payload.data);
      setTotal(payload.meta.total);
      setPage(nextPage);
      setPageSize(nextPageSize);
    } catch {
      if (requestId === requestIdRef.current) toast.error(t.loadError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
        <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
      </div>

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
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{row.prNumber}</td>
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
                        <Badge tone={STATUS_TONE[row.status]}>{en.staff.purchaseOrders.statusLabels[row.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/purchase-orders/${row.id}/proforma`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t.viewFor.replace("{prNumber}", row.prNumber)}
                          className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-harbor transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
                        >
                          {t.viewProforma}
                        </a>
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
              onPageChange={(nextPage) => void fetchRows(nextPage, pageSize)}
              onPageSizeChange={(nextPageSize) => void fetchRows(1, nextPageSize)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
