import type { Metadata } from "next";

import { PurchaseOrderThankYou } from "@/components/vendor-purchase-order/purchase-order-thank-you";
import en from "@/locales/en.json";

export const metadata: Metadata = {
  title: `${en.vendorPurchaseOrder.thankYouTitle} — ${en.auth.brand.word}`,
};

export default function PurchaseOrderThankYouPage() {
  return <PurchaseOrderThankYou />;
}
