import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getInvoiceByToken } from "@/lib/data/purchase-order-invoice";
import { VendorInvoiceForm } from "@/components/purchase-orders/vendor-invoice-form";

export const metadata: Metadata = {
  title: `${en.vendorInvoice.title} — ${en.auth.brand.word}`,
};

export default async function VendorInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let detail: Awaited<ReturnType<typeof getInvoiceByToken>> = null;
  try {
    detail = await getInvoiceByToken(token);
  } catch {
    // Fall through to the invalid state below.
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-5 py-10">
        <main className="w-full max-w-xl rounded-xl border border-line bg-paper p-8 text-center shadow-(--shadow-e2) sm:p-10">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {en.vendorInvoice.invalidTitle}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate">
            {en.vendorInvoice.invalidDescription}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <div className="mb-6 rounded-xl border border-line bg-paper p-6 shadow-(--shadow-e1) sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">{en.vendorInvoice.title}</h1>
          <p className="mt-1.5 text-sm text-slate">{en.vendorInvoice.subtitle}</p>
        </div>
        <div className="rounded-xl border border-line bg-paper p-6 shadow-(--shadow-e1) sm:p-8">
          <VendorInvoiceForm
            token={token}
            prNumber={detail.prNumber}
            vesselLabel={detail.vesselLabel}
            vendorName={detail.vendorName}
          />
        </div>
      </main>
    </div>
  );
}
