"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Button,
  ImagePreviewModal,
  Input,
  Label,
  PhotoThumbnailStack,
  Textarea,
  type PreviewImage,
} from "@/components/atoms";
import en from "@/locales/en.json";
import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";
import type { RfqQuoteDetail, RfqQuoteLineItem } from "@/lib/data/rfq-quote";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { submitStoresVendorQuoteSchema, type SubmitStoresVendorQuoteInput } from "@/lib/validation/vendor-quote";
import { toast } from "@/store/toast-store";

const tCommon = en.vendorQuote;
const t = en.vendorQuote.storesForm;

// Matching literals for finding a line item's dynamic column values — must
// equal the exact labels getPresetColumnsForCategory()'s Stores branch
// assigns at creation time (src/lib/purchase-requisition/preset-columns.ts),
// since that's the only way a dynamic column can be identified after being
// persisted (see line-items-field.tsx's own identical "match by exact label"
// comment). Deliberately sourced from that same createDialog copy, not this
// form's own (display-only) column labels below — a future rename of the
// display label here shouldn't silently break the lookup.
const presetColumnsCopy = en.staff.poRequests.createDialog.columns;
const IMPA_CODE_LABEL = presetColumnsCopy.impaCode;
const UOM_LABEL = presetColumnsCopy.uom;
const APPROVED_QTY_LABEL = presetColumnsCopy.approvedQty;

function findColumnValue(columns: RfqQuoteLineItem["columns"], label: string): string {
  return columns.find((column) => column.label === label)?.value ?? "";
}

function parseApprovedQty(columns: RfqQuoteLineItem["columns"]): number | null {
  const raw = findColumnValue(columns, APPROVED_QTY_LABEL).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeTotalPrice(approvedQty: number | null, unitPriceRaw: string): number | null {
  if (approvedQty === null || !unitPriceRaw.trim()) return null;
  const unitPrice = Number(unitPriceRaw);
  return Number.isFinite(unitPrice) ? approvedQty * unitPrice : null;
}

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";
const sectionHeadingClass = "mb-3 font-display text-[15px] font-semibold text-ink";

function ItemPhotos({ attachments }: { attachments: RfqQuoteLineItem["attachments"] }) {
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

export type StoresQuoteFormProps = {
  token: string;
  detail: RfqQuoteDetail;
};

export function StoresQuoteForm({ token, detail }: StoresQuoteFormProps) {
  const [submitted, setSubmitted] = useState(false);

  const defaultValues = useMemo<SubmitStoresVendorQuoteInput>(
    () => ({
      quotationNo: "",
      refNo: "",
      // The one case where a PR-adjacent value already exists for this exact
      // purpose — the vendor identity the link was issued to — so it's
      // pre-filled but still fully editable, per the spec's own carve-out.
      vendorName: detail.vendorName,
      vendorContactPerson: "",
      vendorContactNo: "",
      vendorEmail: detail.vendorEmail,
      vendorOtherDetails: "",
      quotationValidity: "",
      paymentTerms: "",
      deliveryTerms: "",
      remarksNotes: "",
      items: detail.lineItems.map((item) => ({
        lineItemId: item.lineItemId,
        offeredDescription: "",
        offeredImpaCode: "",
        unitPrice: "",
        deliveryLeadTime: "",
        remarks: "",
      })),
    }),
    [detail],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubmitStoresVendorQuoteInput>({
    resolver: zodResolver(submitStoresVendorQuoteSchema),
    mode: "onBlur",
    defaultValues,
  });

  const [vendorName, quotationValidity, paymentTerms, deliveryTerms, remarksNotes] = watch([
    "vendorName",
    "quotationValidity",
    "paymentTerms",
    "deliveryTerms",
    "remarksNotes",
  ]);
  const requiredFieldsFilled = Boolean(
    vendorName && quotationValidity && paymentTerms && deliveryTerms && remarksNotes,
  );
  const hasErrors = Object.keys(errors).length > 0;

  // Deliberately NOT useMemo: react-hook-form's watch("items") does not
  // reliably return a referentially-new array on every change (it appears to
  // mutate/reuse the same array across renders), so a useMemo keyed on that
  // reference silently never recomputes after the first render even though
  // the values did change. Recomputing on every render instead — a cheap
  // map + arithmetic over a handful of line items — trades a
  // near-zero-cost recompute for actually being correct.
  const watchedItems = watch("items");
  const rowTotals = detail.lineItems.map((item, index) => {
    const approvedQty = parseApprovedQty(item.columns);
    const unitPriceRaw = watchedItems?.[index]?.unitPrice ?? "";
    return computeTotalPrice(approvedQty, unitPriceRaw);
  });
  const grandTotal = rowTotals.reduce((sum: number, value) => sum + (value ?? 0), 0);

  async function onSubmit(data: SubmitStoresVendorQuoteInput) {
    try {
      const response = await fetch(`/api/quote/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? tCommon.submitError);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error(tCommon.submitError);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-105 text-center">
        <h2 className="font-display text-[23px] font-semibold text-ink">{tCommon.submittedTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">{tCommon.submittedDescription}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <section>
        <h2 className={sectionHeadingClass}>{t.rfqDetails.title}</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label>{t.rfqDetails.vesselName}</Label>
            <Input disabled value={displayValue(detail.vesselLabel)} />
          </div>
          <div>
            <Label>{t.rfqDetails.imoNo}</Label>
            <Input disabled value={displayValue(detail.vesselImoNo)} />
          </div>
          <div>
            <Label>{t.rfqDetails.dateOfIssue}</Label>
            <Input disabled value={displayValue(detail.requisitionDate)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requisitionNo}</Label>
            <Input disabled value={detail.prNumber} />
          </div>
          <div>
            <Label>{t.rfqDetails.portOfDelivery}</Label>
            <Input disabled value={displayValue(detail.requiredPort)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requiredDate}</Label>
            <Input disabled value={displayValue(detail.requestedBy)} />
          </div>
          <div>
            <Label>{t.rfqDetails.requestedCurrency}</Label>
            <Input disabled value={VENDOR_QUOTE_CURRENCY} />
          </div>
          <div />
          <div>
            <Label htmlFor="quote-quotation-no">{t.rfqDetails.quotationNo}</Label>
            <Input
              id="quote-quotation-no"
              type="text"
              placeholder={t.rfqDetails.quotationNoPlaceholder}
              {...register("quotationNo")}
            />
          </div>
          <div>
            <Label htmlFor="quote-ref-no">{t.rfqDetails.refNo}</Label>
            <Input id="quote-ref-no" type="text" placeholder={t.rfqDetails.refNoPlaceholder} {...register("refNo")} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className={sectionHeadingClass}>{t.vendorDetails.title}</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label htmlFor="quote-vendor-name" error={!!errors.vendorName}>
              {t.vendorDetails.vendorName}
            </Label>
            <Input
              id="quote-vendor-name"
              type="text"
              placeholder={t.vendorDetails.vendorNamePlaceholder}
              error={errors.vendorName?.message}
              {...register("vendorName")}
            />
          </div>
          <div>
            <Label htmlFor="quote-contact-person">
              {t.vendorDetails.contactPerson} <span className="font-normal text-slate-lt">{t.vendorDetails.optional}</span>
            </Label>
            <Input id="quote-contact-person" type="text" {...register("vendorContactPerson")} />
          </div>
          <div>
            <Label htmlFor="quote-contact-no">
              {t.vendorDetails.contactNo} <span className="font-normal text-slate-lt">{t.vendorDetails.optional}</span>
            </Label>
            <Input id="quote-contact-no" type="text" {...register("vendorContactNo")} />
          </div>
          <div>
            <Label htmlFor="quote-vendor-email" error={!!errors.vendorEmail}>
              {t.vendorDetails.email} <span className="font-normal text-slate-lt">{t.vendorDetails.optional}</span>
            </Label>
            <Input
              id="quote-vendor-email"
              type="email"
              error={errors.vendorEmail?.message}
              {...register("vendorEmail")}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="quote-vendor-other-details">
              {t.vendorDetails.otherDetails} <span className="font-normal text-slate-lt">{t.vendorDetails.optional}</span>
            </Label>
            <Textarea id="quote-vendor-other-details" {...register("vendorOtherDetails")} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className={sectionHeadingClass}>{t.itemDetails.title}</h2>
        {/* Hidden inputs live outside the <table> entirely — a bare <input>
            isn't valid as a direct child of <tr> (only <td>/<th> are), so
            each row's fixed, never-edited lineItemId is registered here
            instead, matching how issue-rfq-dialog.tsx registers its own
            derived expiresAt value via a hidden input rather than a table cell. */}
        {detail.lineItems.map((item, index) => (
          <input key={item.lineItemId} type="hidden" {...register(`items.${index}.lineItemId`)} />
        ))}
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
              </tr>
            </thead>
            <tbody>
              {detail.lineItems.map((item, index) => (
                <tr key={item.lineItemId} className="border-b border-line last:border-b-0">
                  <td className={cellClass}>{index + 1}</td>
                  <td className={cellClass}>
                    <Input disabled value={item.description} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(findColumnValue(item.columns, IMPA_CODE_LABEL))} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(findColumnValue(item.columns, APPROVED_QTY_LABEL))} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(findColumnValue(item.columns, UOM_LABEL))} />
                  </td>
                  <td className={cellClass}>
                    <ItemPhotos attachments={item.attachments} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.offeredDescription`)} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.offeredImpaCode`)} />
                  </td>
                  <td className={cellClass}>
                    <Input
                      type="text"
                      inputMode="decimal"
                      error={errors.items?.[index]?.unitPrice?.message}
                      {...register(`items.${index}.unitPrice`)}
                    />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={rowTotals[index] === null ? "—" : formatCurrencyUsd(rowTotals[index])} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.deliveryLeadTime`)} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.remarks`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2 text-[13.5px]">
          <span className="font-bold text-ink">{t.itemDetails.grandTotal}</span>
          <span className="font-mono text-ink">{formatCurrencyUsd(grandTotal)}</span>
        </div>
      </section>

      <section className="mt-8">
        <h2 className={sectionHeadingClass}>{t.quotationSummary.title}</h2>
        <div className="mb-4">
          <Label>{t.quotationSummary.totalQuotedAmount}</Label>
          <Input disabled value={formatCurrencyUsd(grandTotal)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label htmlFor="quote-validity" error={!!errors.quotationValidity}>
              {t.quotationSummary.quotationValidity}
            </Label>
            <Input
              id="quote-validity"
              type="text"
              placeholder={t.quotationSummary.quotationValidityPlaceholder}
              error={errors.quotationValidity?.message}
              {...register("quotationValidity")}
            />
          </div>
          <div>
            <Label htmlFor="quote-payment-terms" error={!!errors.paymentTerms}>
              {t.quotationSummary.paymentTerms}
            </Label>
            <Input
              id="quote-payment-terms"
              type="text"
              placeholder={t.quotationSummary.paymentTermsPlaceholder}
              error={errors.paymentTerms?.message}
              {...register("paymentTerms")}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="quote-delivery-terms" error={!!errors.deliveryTerms}>
              {t.quotationSummary.deliveryTerms}
            </Label>
            <Input
              id="quote-delivery-terms"
              type="text"
              placeholder={t.quotationSummary.deliveryTermsPlaceholder}
              error={errors.deliveryTerms?.message}
              {...register("deliveryTerms")}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="quote-remarks-notes" error={!!errors.remarksNotes}>
              {t.quotationSummary.remarksNotes}
            </Label>
            <Textarea
              id="quote-remarks-notes"
              error={errors.remarksNotes?.message}
              {...register("remarksNotes")}
            />
          </div>
        </div>
      </section>

      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={!requiredFieldsFilled || hasErrors}
        className="mt-8 w-full"
      >
        {isSubmitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
