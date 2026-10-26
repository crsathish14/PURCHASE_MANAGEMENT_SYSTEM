import type { Metadata } from "next";

import en from "@/locales/en.json";
import { PurchaseOrderForm } from "@/components/vendor-purchase-order/purchase-order-form";
import { getPurchaseOrderByToken } from "@/lib/data/purchase-orders";

export const metadata: Metadata = {
  title: `${en.vendorPurchaseOrder.title} — ${en.auth.brand.word}`,
};

export default async function VendorPurchaseOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getPurchaseOrderByToken(token);
  return <PurchaseOrderForm detail={detail} token={token} />;
}
