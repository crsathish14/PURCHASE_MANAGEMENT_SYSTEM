import en from "@/locales/en.json";
import { Button } from "@/components/atoms";
import type { PurchaseOrderVendorDetail } from "@/lib/data/purchase-orders";
import { formatCurrencyUsd } from "@/lib/format-currency";

const t = en.vendorPurchaseOrder;
const DATE_FORMATTER = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const cellClass = "px-3 py-2.5 align-top text-sm text-ink";
const headerClass = "px-3 py-2.5 text-left text-[11px] font-bold tracking-wide text-slate-lt uppercase";

function displayValue(value: string | null): string {
  return value?.trim() || "—";
}

export function PurchaseOrderForm({ detail }: { detail: PurchaseOrderVendorDetail | null }) {
  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-5 py-10">
        <section className="w-full max-w-xl rounded-xl border border-line bg-paper p-8 shadow-(--shadow-e2)">
          <p className="font-display text-xl font-semibold text-ink">{t.invalidTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate">{t.invalidDescription}</p>
        </section>
      </div>
    );
  }

  const orderTotal = detail.items.reduce((total, item) => total + item.totalPrice, 0);

  return (
    <div className="min-h-screen bg-mist px-4 py-8 sm:px-6 sm:py-12">
      <main className="mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e2)">
        <header className="border-b border-line px-6 py-5 sm:px-8">
          <p className="font-display text-sm font-bold tracking-[0.14em] text-harbor uppercase">
            {en.auth.brand.word}
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1 text-sm text-slate">{t.subtitle}</p>
        </header>

        <div className="space-y-7 px-6 py-6 sm:px-8">
          <section className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.prNumber}</p>
              <p className="mt-1 font-mono text-sm text-ink">{detail.prNumber}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.vendor}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{detail.vendorName}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.vendorEmail}</p>
              <p className="mt-1 break-all text-sm text-ink">{detail.vendorEmail}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.vessel}</p>
              <p className="mt-1 text-sm text-ink">{displayValue(detail.vesselLabel)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.issuedAt}</p>
              <p className="mt-1 text-sm text-ink">{DATE_FORMATTER.format(new Date(detail.issuedAt))}</p>
            </div>
          </section>

          {detail.message ? (
            <section className="rounded-lg border border-line bg-mist px-4 py-3.5">
              <p className="mb-1 text-[11px] font-bold tracking-wide text-slate-lt uppercase">{t.message}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{detail.message}</p>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">{t.itemsTitle}</h2>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-180 text-left">
                <thead className="border-b border-line bg-mist">
                  <tr>
                    <th className={headerClass}>{t.description}</th>
                    <th className={headerClass}>{t.partNo}</th>
                    <th className={headerClass}>{t.uom}</th>
                    <th className={`${headerClass} text-right`}>{t.quantity}</th>
                    <th className={`${headerClass} text-right`}>{t.unitPrice}</th>
                    <th className={`${headerClass} text-right`}>{t.lineTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, index) => (
                    <tr key={`${item.description}-${index}`} className="border-b border-line last:border-b-0">
                      <td className={cellClass}>{item.description}</td>
                      <td className={cellClass}>{displayValue(item.partNo)}</td>
                      <td className={cellClass}>{displayValue(item.uom)}</td>
                      <td className={`${cellClass} text-right font-mono`}>{item.quantity ?? "—"}</td>
                      <td className={`${cellClass} whitespace-nowrap text-right font-mono`}>
                        {formatCurrencyUsd(item.unitPrice)}
                      </td>
                      <td className={`${cellClass} whitespace-nowrap text-right font-mono`}>
                        {formatCurrencyUsd(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-mist">
                  <tr>
                    <th colSpan={5} className="px-3 py-3 text-right text-sm font-bold text-ink">
                      {t.grandTotal}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-bold text-ink">
                      {formatCurrencyUsd(orderTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" disabled>
              {t.download}
            </Button>
            <Button type="button" disabled>
              {t.submit}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
