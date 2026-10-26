import { CheckCircle2 } from "lucide-react";

import en from "@/locales/en.json";

const t = en.vendorPurchaseOrder;

export function PurchaseOrderThankYou() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-5 py-10">
      <main className="w-full max-w-xl rounded-xl border border-line bg-paper p-8 text-center shadow-(--shadow-e2) sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-moss-bg text-moss">
          <CheckCircle2 size={30} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">{t.thankYouTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate">{t.thankYouDescription}</p>
        <p className="mt-5 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-slate">
          {t.thankYouLinkExpired}
        </p>
      </main>
    </div>
  );
}
