"use client";

import { useState } from "react";

import { Badge, ImagePreviewModal, Input, Label, PhotoThumbnailStack, Textarea, type PreviewImage } from "@/components/atoms";
import en from "@/locales/en.json";
import type { PrLineItemAttachment } from "@/lib/data/purchase-requisition";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";

// A read-only clone of stores-quote-form.tsx's exact section structure,
// reusing its copy verbatim (en.vendorQuote.storesForm) since every field
// means exactly the same thing here — just displaying a vendor's already-
// submitted answers instead of collecting them. Every field renders
// `disabled` (not `readOnly`): this whole card is never interactive, and
// `disabled` is the same visual treatment the original form already uses for
// its own non-editable PR-context fields, so nothing here looks editable.
const t = en.vendorQuote.storesForm;
const tCompare = en.staff.requestedQuote.compare;

const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";
const sectionHeadingClass = "mb-3 font-display text-[15px] font-semibold text-ink";
const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

function ItemPhotos({ attachments }: { attachments: PrLineItemAttachment[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (attachments.length === 0) {
    return <span className="text-xs text-slate-lt">{t.itemDetails.noPhotos}</span>;
  }

  const previewImages: PreviewImage[] = attachments.map((attachment) => ({
    url: attachment.url,
    fileName: attachment.fileName,
  }));

  return (
    <>
      <PhotoThumbnailStack
        images={previewImages}
        onSelect={(index) => setPreviewIndex(index)}
        ariaLabel={(count) =>
          count > 1 ? t.itemDetails.viewPhotoStack.replace("{count}", String(count)) : t.itemDetails.viewPhoto
        }
      />
      <ImagePreviewModal
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={previewImages}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}

export type StoresQuoteComparisonCardProps = {
  vendor: QuoteComparisonVendor;
  pr: {
    prNumber: string;
    vesselLabel: string | null;
    vesselImoNo: string | null;
    requisitionDate: string | null;
    requiredPort: string | null;
    requiredDate: string | null;
  };
  isLowest: boolean;
};

export function StoresQuoteComparisonCard({ vendor, pr, isLowest }: StoresQuoteComparisonCardProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-line bg-paper p-5">
      <div className="mb-6 flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{vendor.vendorName}</h2>
          <p className="mt-0.5 text-[11px] text-slate-lt">
            {tCompare.submittedOn.replace("{date}", dateFormatter.format(new Date(vendor.submittedAt)))}
          </p>
        </div>
        {isLowest ? <Badge tone="moss">{tCompare.lowestTotalBadge}</Badge> : null}
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
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-275 border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={`${headerCellClass} w-10`}>{t.itemDetails.columns.slNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.requestedDescription}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.impaCode}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.approvedQty}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.uom}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.photos}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.offeredDescription}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.offeredImpaCode}</th>
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
                    <Input disabled value={displayValue(item.requestedImpaCode)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.approvedQty)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.uom)} />
                  </td>
                  <td className={cellClass}>
                    <ItemPhotos attachments={item.attachments} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.offeredDescription)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.offeredImpaCode)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={formatCurrencyUsd(item.unitPrice)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={formatCurrencyUsd(item.totalPrice)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.deliveryLeadTime)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(item.remarks)} />
                  </td>
                  <td className={cellClass}>
                    <ItemPhotos attachments={item.vendorPhotos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2 text-[13.5px]">
          <span className="font-bold text-ink">{t.itemDetails.grandTotal}</span>
          <span className="font-mono text-ink">{formatCurrencyUsd(vendor.totalQuotedAmount)}</span>
        </div>
      </section>

      <section className="mt-8">
        <h3 className={sectionHeadingClass}>{t.quotationSummary.title}</h3>
        <div className="mb-4">
          <Label>{t.quotationSummary.totalQuotedAmount}</Label>
          <div className="flex items-center gap-2">
            <Input disabled value={formatCurrencyUsd(vendor.totalQuotedAmount)} className="flex-1" />
            {isLowest ? <Badge tone="moss">{tCompare.lowestTotalBadge}</Badge> : null}
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
