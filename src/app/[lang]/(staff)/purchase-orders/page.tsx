import type { Metadata } from "next";

import { PurchaseOrdersView } from "@/components/purchase-orders/purchase-orders-view";
import en from "@/locales/en.json";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { getPurchaseOrders } from "@/lib/data/purchase-orders";
import { requireActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;
const DEFAULT_PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function PurchaseOrdersPage() {
  await requireActiveUser();
  const [dropdownFields, { rows, total }] = await Promise.all([
    getPrDropdownFields(),
    getPurchaseOrders({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return <PurchaseOrdersView initialDropdownFields={dropdownFields} initialRows={rows} initialTotal={total} />;
}
