"use client";

import { Badge, Button, Checkbox, Input, Label, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";
import {
  getNeededPoLineTotal,
  getNeededPoQty,
  getPurchaseOrderAmount,
  isValidNeededPoQty,
  type PurchaseOrderQuantityEditor,
} from "@/components/purchase-orders/purchase-order-quantity-editor";
import { ItemPhotos } from "@/components/vendor-quote/item-photos";

// A read-only clone of stores-quote-comparison-card.tsx's structure, reusing
// en.vendorQuote.loForm copy — same fields as Stores without IMPA code
// columns (no "IMPA/ISSA Code" and no "Offered IMPA/ISSA Code").
const t = en.vendorQuote.loForm;
const tCompare = en.staff.requestedQuote.compare;
const tPo = en.staff.purchaseOrders;

const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";
const sectionHeadingClass = "mb-3 font-display text-[15px] font-semibold text-ink";
const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

export type LoQuoteComparisonCardProps = {
  vendor: QuoteComparisonVendor;
  pr: {
    prNumber: string;
    vesselLabel: string | null;
    vesselImoNo: string | null;
    requisitionDate: string | null;
    requiredPort: string | null;
    requiredDate: string | null;
  };
  isAwarded: boolean;
  canAward: boolean;
  onAward: () => void;
  purchaseOrderEditor?: PurchaseOrderQuantityEditor;
};

export function LoQuoteComparisonCard({
  vendor,
  pr,
  isAwarded,
  canAward,
  onAward,
  purchaseOrderEditor,
}: LoQuoteComparisonCardProps) {
  const purchaseOrderAmount = getPurchaseOrderAmount(purchaseOrderEditor, vendor);
  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-line bg-paper p-5">
      <div className="mb-6 flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{vendor.vendorName}</h2>
          <p className="mt-0.5 text-[11px] text-slate-lt">
            {tCompare.submittedOn.replace("{date}", dateFormatter.format(new Date(vendor.submittedAt)))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isAwarded ? (
            <Badge tone="moss">{tCompare.awardedBadge}</Badge>
          ) : canAward ? (
            <Button type="button" variant="primary" size="sm" onClick={onAward}>
              {tCompare.award}
            </Button>
          ) : null}
        </div>
      </div>

      <section>
        <h3 className={sectionHeadingClass}>{t.rfqDetails.title}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label>{t.rfqDetails.vesselName}</Label>
            <Input disabled value={displayValue(pr.vesselLabel)} />
          </div>
          <div>
            <Label>{t.rfqDetails.imoNo}</Label>
            <Input disabled value={displayValue(pr.vesselImoNo)} />
          </div>
          <div>
            <Label>{t.rfqDetails.dateOfIssue}</Label>
            <Input disabled value={displayValue(pr.requisitionDate)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requisitionNo}</Label>
            <Input disabled value={pr.prNumber} />
          </div>
          <div>
            <Label>{t.rfqDetails.portOfDelivery}</Label>
            <Input disabled value={displayValue(pr.requiredPort)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requiredDate}</Label>
            <Input disabled value={displayValue(pr.requiredDate)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requestedCurrency}</Label>
            <Input disabled value={VENDOR_QUOTE_CURRENCY} />
          </div>
          <div />
          <div>
            <Label>{t.rfqDetails.quotationNo}</Label>
            <Input disabled value={displayValue(vendor.quotationNo)} />
          </div>
          <div>
            <Label>{t.rfqDetails.refNo}</Label>
            <Input disabled value={displayValue(vendor.refNo)} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h3 className={sectionHeadingClass}>{t.vendorDetails.title}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label>{t.vendorDetails.vendorName}</Label>
            <Input disabled value={vendor.vendorName} />
          </div>
          <div>
            <Label>{t.vendorDetails.contactPerson}</Label>
            <Input disabled value={displayValue(vendor.vendorContactPerson)} />
          </div>
          <div>
            <Label>{t.vendorDetails.contactNo}</Label>
            <Input disabled value={displayValue(vendor.vendorContactNo)} />
          </div>
          <div>
            <Label>{t.vendorDetails.email}</Label>
            <Input disabled value={displayValue(vendor.vendorEmail)} />
          </div>
          <div className="col-span-2">
            <Label>{t.vendorDetails.otherDetails}</Label>
            <Textarea disabled value={displayValue(vendor.vendorOtherDetails)} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h3 className={sectionHeadingClass}>{t.itemDetails.title}</h3>
        {purchaseOrderEditor ? (
          <div className="mb-3 flex items-center gap-2">
            <Checkbox
              id={`po-qty-same-${vendor.quotationId}`}
              checked={purchaseOrderEditor.sameAsQuoteQty}
              disabled={purchaseOrderEditor.disabled}
              onChange={(event) => purchaseOrderEditor.onSameAsQuoteQtyChange(event.target.checked)}
            />
            <label htmlFor={`po-qty-same-${vendor.quotationId}`} className="text-xs font-semibold text-ink">
              {tPo.sameAsQuoteQty}
            </label>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-225 border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={`${headerCellClass} w-10`}>{t.itemDetails.columns.slNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.requestedDescription}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.approvedQty}</th>
                {purchaseOrderEditor ? <th className={headerCellClass}>{tPo.neededPoQty}</th> : null}
                <th className={headerCellClass}>{t.itemDetails.columns.uom}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.photos}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.offeredDescription}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.unitPrice}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.totalPrice}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.deliveryLeadTime}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.remarks}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.vendorPhotos}</th>
              </tr>
            </thead>
            <tbody>
              {vendor.lineItems.map((item, index) => (
                <tr key={item.lineItemId} className="border-b border-line last:border-b-0">
                  <td className={cellClass}>{index + 1}</td>
                  <td className={cellClass}>
                    <Input disabled value={item.requestedDescription} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.approvedQty)} />
                  </td>
                  {purchaseOrderEditor ? (
                    <td className={cellClass}>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        required
                        disabled={purchaseOrderEditor.disabled}
                        value={getNeededPoQty(purchaseOrderEditor, item)}
                        aria-label={tPo.neededPoQtyFor.replace("{item}", item.requestedDescription)}
                        error={
                          purchaseOrderEditor.validationAttempted &&
                          !isValidNeededPoQty(getNeededPoQty(purchaseOrderEditor, item))
                            ? tPo.invalidQuantity
                            : undefined
                        }
                        onChange={(event) =>
                          purchaseOrderEditor.onQuantityChange(item.quotationItemId, event.target.value)
                        }
                      />
                    </td>
                  ) : null}
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.uom)} />
                  </td>
                  <td className={cellClass}>
                    <ItemPhotos attachments={item.attachments} t={t.itemDetails} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.offeredDescription)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={formatCurrencyUsd(item.unitPrice)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={formatCurrencyUsd(getNeededPoLineTotal(purchaseOrderEditor, item))} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.deliveryLeadTime)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.remarks)} />
                  </td>
                  <td className={cellClass}>
                    <ItemPhotos attachments={item.vendorPhotos} t={t.itemDetails} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2 text-[13.5px]">
          <span className="font-bold text-ink">{t.itemDetails.grandTotal}</span>
          <span className="font-mono text-ink">{formatCurrencyUsd(purchaseOrderAmount)}</span>
        </div>
      </section>

      <section className="mt-8">
        <h3 className={sectionHeadingClass}>{t.quotationSummary.title}</h3>
        <div className="mb-4">
          <Label>{purchaseOrderEditor ? tPo.purchaseOrderTotal : t.quotationSummary.totalQuotedAmount}</Label>
          <div className="flex items-center gap-2">
            <Input disabled value={formatCurrencyUsd(purchaseOrderAmount)} className="flex-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label>{t.quotationSummary.quotationValidity}</Label>
            <Input disabled value={vendor.quotationValidity} />
          </div>
          <div>
            <Label>{t.quotationSummary.paymentTerms}</Label>
            <Input disabled value={vendor.paymentTerms} />
          </div>
          <div className="col-span-2">
            <Label>{t.quotationSummary.deliveryTerms}</Label>
            <Input disabled value={vendor.deliveryTerms} />
          </div>
          <div className="col-span-2">
            <Label>{t.quotationSummary.remarksNotes}</Label>
            <Textarea disabled value={vendor.remarksNotes} />
          </div>
        </div>
      </section>
    </div>
  );
}
