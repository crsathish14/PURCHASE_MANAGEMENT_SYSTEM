import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getPurchaseOrders } from "@/lib/data/purchase-orders";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { InvoiceLogView } from "@/components/purchase-orders/invoice-log-view";
import { PURCHASE_ORDER_STATUS } from "@/lib/constants/purchase-order";

const t = en.staff.invoiceLog;
const DEFAULT_PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function InvoiceLogPage() {
  await requireActiveUser();
  const [dropdownFields, { rows, total }] = await Promise.all([
    getPrDropdownFields(),
    getPurchaseOrders({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      statuses: [
        PURCHASE_ORDER_STATUS.PROFORMA_RECEIVED,
        PURCHASE_ORDER_STATUS.INVOICE_REQUESTED,
        PURCHASE_ORDER_STATUS.INVOICE_RECEIVED,
      ],
    }),
  ]);
  return <InvoiceLogView initialDropdownFields={dropdownFields} initialRows={rows} initialTotal={total} />;
}
