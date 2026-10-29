import type { Metadata } from "next";

import en from "@/locales/en.json";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import { getPurchaseOrders } from "@/lib/data/purchase-orders";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { InvoiceLogView } from "@/components/purchase-orders/invoice-log-view";

const t = en.staff.invoiceLog;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VALID_DATE_PRESETS = new Set<string>(Object.values(DATE_PRESET));
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const INVOICE_LOG_STATUSES = [
  PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED,
  PURCHASE_ORDER_STATUS.INVOICE_REQUESTED,
  PURCHASE_ORDER_STATUS.INVOICE_RECEIVED,
] as const;
const VALID_INVOICE_STATUSES = new Set<string>(INVOICE_LOG_STATUSES);

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

type SP = Record<string, string | string[] | undefined>;
function getStr(p: SP, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v.trim() : "";
}
function getCsv(p: SP, key: string): string[] {
  const v = getStr(p, key);
  return v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [];
}
function parseProformaDateFilter(p: SP): { proformaDatePreset?: DatePreset; proformaStartDate?: string; proformaEndDate?: string } {
  const preset = getStr(p, "proformaDatePreset");
  if (!preset || !VALID_DATE_PRESETS.has(preset)) return {};
  const proformaDatePreset = preset as DatePreset;
  if (proformaDatePreset !== DATE_PRESET.CUSTOM) return { proformaDatePreset };
  const df = getStr(p, "proformaDateFrom");
  const dt = getStr(p, "proformaDateTo");
  if (!df || !dt || !ISO_DATE_RE.test(df) || !ISO_DATE_RE.test(dt)) return {};
  const today = new Date().toISOString().slice(0, 10);
  const proformaEndDate = dt > today ? today : dt;
  if (df > proformaEndDate) return {};
  return { proformaDatePreset, proformaStartDate: df, proformaEndDate };
}

export default async function InvoiceLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireActiveUser();
  const sp = await searchParams;

  const rawPage = Number(getStr(sp, "page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = Number(getStr(sp, "pageSize"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;
  const search = getStr(sp, "q");
  const rawStatuses = getCsv(sp, "status").filter((s): s is PurchaseOrderStatus => VALID_INVOICE_STATUSES.has(s));
  // Always restrict to the 3 invoice-log statuses — never let pending_po/po_issued slip in.
  const statuses = rawStatuses.length ? rawStatuses : [...INVOICE_LOG_STATUSES];
  const vessels = getCsv(sp, "vessel");
  const categories = getCsv(sp, "category");
  const { proformaDatePreset, proformaStartDate, proformaEndDate } = parseProformaDateFilter(sp);

  const initialFilters = {
    page,
    pageSize,
    search,
    // Store only the user's selection (empty = no filter chosen = show all 3).
    statuses: rawStatuses,
    vessels,
    categories,
    proformaDatePreset: proformaDatePreset ?? null,
    proformaStartDate: proformaStartDate ?? null,
    proformaEndDate: proformaEndDate ?? null,
  };

  const [dropdownFields, { rows, total }] = await Promise.all([
    getPrDropdownFields(),
    getPurchaseOrders({
      page,
      pageSize,
      statuses,
      search: search || undefined,
      vessels: vessels.length ? vessels : undefined,
      categories: categories.length ? categories : undefined,
      proformaDatePreset,
      proformaStartDate,
      proformaEndDate,
    }),
  ]);

  return <InvoiceLogView initialDropdownFields={dropdownFields} initialRows={rows} initialTotal={total} initialFilters={initialFilters} />;
}
