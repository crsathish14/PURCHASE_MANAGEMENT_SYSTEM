"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Input } from "@/components/atoms";
import en from "@/locales/en.json";
import type { RfqQuoteDetail, RfqQuoteLineItem } from "@/lib/data/rfq-quote";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { submitSparesVendorQuoteSchema, type SubmitSparesVendorQuoteInput } from "@/lib/validation/vendor-quote";
import { toast } from "@/store/toast-store";
import { displayValue } from "./format-display-value";
import { EquipmentDetailsSection } from "./equipment-details-section";
import { QuotationSummarySection } from "./quotation-summary-section";
import { RfqDetailsSection } from "./rfq-details-section";
import { VendorDetailsSection } from "./vendor-details-section";
import { VendorItemPhotosField, type VendorPhotoValue } from "./vendor-item-photos-field";

const tCommon = en.vendorQuote;
const t = en.vendorQuote.sparesForm;

// Matching literals for finding a line item's dynamic column values — must
// equal the exact labels getPresetColumnsForCategory()'s Spares branch
// assigns at creation time (src/lib/purchase-requisition/preset-columns.ts),
// same "match by exact label" approach stores-quote-form.tsx already uses.
// Sourced from the office createDialog copy (not this form's own display-only
// column labels below), so a future rename of the display label here can't
// silently break the lookup.
const presetColumnsCopy = en.staff.poRequests.createDialog.columns;
const PART_NO_LABEL = presetColumnsCopy.partNo;
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

const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";
const sectionHeadingClass = "mb-3 font-display text-[15px] font-semibold text-ink";

export type SparesQuoteFormProps = {
  token: string;
  detail: RfqQuoteDetail;
};

export function SparesQuoteForm({ token, detail }: SparesQuoteFormProps) {
  const [submitted, setSubmitted] = useState(false);
  // Not RHF-registered (see vendor-item-photos-field.tsx) — photos are
  // merged into each item's payload at submit time instead.
  const [photosByIndex, setPhotosByIndex] = useState<Record<number, VendorPhotoValue[]>>({});

  const defaultValues = useMemo<SubmitSparesVendorQuoteInput>(
    () => ({
      quotationNo: "",
      refNo: "",
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
        offeredPartNo: "",
        itemType: "",
        unitPrice: "",
        deliveryLeadTime: "",
        remarks: "",
        // Never actually read back from RHF state (see onSubmit) — kept here
        // only so this object satisfies SubmitSparesVendorQuoteInput's shape.
        photos: [],
      })),
    }),
    [detail],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubmitSparesVendorQuoteInput>({
    resolver: zodResolver(submitSparesVendorQuoteSchema),
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

  // Deliberately NOT useMemo — same reasoning as stores-quote-form.tsx:
  // react-hook-form's watch("items") doesn't reliably return a
  // referentially-new array on every change, so a useMemo keyed on it
  // silently stops recomputing. Recomputed on every render instead.
  const watchedItems = watch("items");
  const rowTotals = detail.lineItems.map((item, index) => {
    const approvedQty = parseApprovedQty(item.columns);
    const unitPriceRaw = watchedItems?.[index]?.unitPrice ?? "";
    return computeTotalPrice(approvedQty, unitPriceRaw);
  });
  const grandTotal = rowTotals.reduce((sum: number, value) => sum + (value ?? 0), 0);

  async function onSubmit(data: SubmitSparesVendorQuoteInput) {
    const payload = {
      ...data,
      items: data.items.map((item, index) => ({
        ...item,
        photos: (photosByIndex[index] ?? []).map(({ storagePath, fileName, contentType, sizeBytes }) => ({
          storagePath,
          fileName,
          contentType,
          sizeBytes,
        })),
      })),
    };

    try {
      const response = await fetch(`/api/quote/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        toast.error(responseBody?.error?.message ?? tCommon.submitError);
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
      <RfqDetailsSection t={t.rfqDetails} detail={detail} register={register} sectionHeadingClass={sectionHeadingClass} />

      <VendorDetailsSection
        t={t.vendorDetails}
        register={register}
        errors={errors}
        sectionHeadingClass={sectionHeadingClass}
      />

      <EquipmentDetailsSection t={t.equipmentDetails} detail={detail} sectionHeadingClass={sectionHeadingClass} />

      <section className="mt-8">
        <h2 className={sectionHeadingClass}>{t.itemDetails.title}</h2>
        {detail.lineItems.map((item, index) => (
          <input key={item.lineItemId} type="hidden" {...register(`items.${index}.lineItemId`)} />
        ))}
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-275 border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={`${headerCellClass} w-10`}>{t.itemDetails.columns.slNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.requestedDescription}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.partNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.offeredDescription}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.offeredPartNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.itemType}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.qty}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.uom}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.unitPrice}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.totalPrice}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.deliveryLeadTime}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.remarks}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.vendorPhotos}</th>
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
                    <Input disabled value={displayValue(findColumnValue(item.columns, PART_NO_LABEL))} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.offeredDescription`)} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.offeredPartNo`)} />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.itemType`)} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(findColumnValue(item.columns, APPROVED_QTY_LABEL))} />
                  </td>
                  <td className={cellClass}>
                    <Input disabled value={displayValue(findColumnValue(item.columns, UOM_LABEL))} />
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
                    <Input
                      type="text"
                      inputMode="numeric"
                      error={errors.items?.[index]?.deliveryLeadTime?.message}
                      {...register(`items.${index}.deliveryLeadTime`)}
                    />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.remarks`)} />
                  </td>
                  <td className={cellClass}>
                    <VendorItemPhotosField
                      token={token}
                      lineItemId={item.lineItemId}
                      value={photosByIndex[index] ?? []}
                      onChange={(next) => setPhotosByIndex((prev) => ({ ...prev, [index]: next }))}
                    />
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

      <QuotationSummarySection
        t={t.quotationSummary}
        grandTotal={grandTotal}
        register={register}
        errors={errors}
        sectionHeadingClass={sectionHeadingClass}
      />

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
