"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Input } from "@/components/atoms";
import en from "@/locales/en.json";
import type { RfqQuoteDetail } from "@/lib/data/rfq-quote";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { submitServiceVendorQuoteSchema, type SubmitServiceVendorQuoteInput } from "@/lib/validation/vendor-quote";
import { toast } from "@/store/toast-store";
import { EquipmentDetailsSection } from "./equipment-details-section";
import { ItemPhotos } from "./item-photos";
import { QuotationSummarySection } from "./quotation-summary-section";
import { RfqDetailsSection } from "./rfq-details-section";
import { VendorDetailsSection } from "./vendor-details-section";
import { VendorItemPhotosField, type VendorPhotoValue } from "./vendor-item-photos-field";

const tCommon = en.vendorQuote;
const t = en.vendorQuote.serviceForm;

// Service has no Qty/UOM concept at all (see preset-columns.ts's Service
// branch), so — unlike Stores/Spares — there is no dynamic-column lookup or
// approved-qty-based total here. Total Price mirrors Unit Price/Lump Sum
// directly (confirmed product decision), computed the same
// not-useMemo'd-off-watch() way stores-quote-form.tsx's own row totals are,
// for the same reason: react-hook-form's watch("items") doesn't reliably
// return a referentially-new array on every change.
function parseUnitPrice(unitPriceRaw: string): number | null {
  if (!unitPriceRaw.trim()) return null;
  const unitPrice = Number(unitPriceRaw);
  return Number.isFinite(unitPrice) ? unitPrice : null;
}

const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
const cellClass = "px-2 py-1.5 align-top";
const sectionHeadingClass = "mb-3 font-display text-[15px] font-semibold text-ink";

export type ServiceQuoteFormProps = {
  token: string;
  detail: RfqQuoteDetail;
};

export function ServiceQuoteForm({ token, detail }: ServiceQuoteFormProps) {
  const [submitted, setSubmitted] = useState(false);
  // Not RHF-registered (see vendor-item-photos-field.tsx) — photos are
  // merged into each item's payload at submit time instead.
  const [photosByIndex, setPhotosByIndex] = useState<Record<number, VendorPhotoValue[]>>({});

  const defaultValues = useMemo<SubmitServiceVendorQuoteInput>(
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
        estimatedDuration: "",
        sparesConsumablesIncluded: "",
        unitPrice: "",
        remarks: "",
        // Never actually read back from RHF state (see onSubmit) — kept here
        // only so this object satisfies SubmitServiceVendorQuoteInput's shape.
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
  } = useForm<SubmitServiceVendorQuoteInput>({
    resolver: zodResolver(submitServiceVendorQuoteSchema),
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

  // Deliberately NOT useMemo — see parseUnitPrice's own comment above.
  const watchedItems = watch("items");
  const rowTotals = detail.lineItems.map((_item, index) => {
    const unitPriceRaw = watchedItems?.[index]?.unitPrice ?? "";
    return parseUnitPrice(unitPriceRaw);
  });
  const grandTotal = rowTotals.reduce((sum: number, value) => sum + (value ?? 0), 0);

  async function onSubmit(data: SubmitServiceVendorQuoteInput) {
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
          <table className="w-full min-w-250 border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={`${headerCellClass} w-10`}>{t.itemDetails.columns.slNo}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.description}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.photos}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.estimatedDuration}</th>
                <th className={headerCellClass}>{t.itemDetails.columns.sparesConsumablesIncluded}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.unitPrice}</th>
                <th className={`${headerCellClass} w-24`}>{t.itemDetails.columns.totalPrice}</th>
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
                    <ItemPhotos attachments={item.attachments} t={t.itemDetails} />
                  </td>
                  <td className={cellClass}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      error={errors.items?.[index]?.estimatedDuration?.message}
                      {...register(`items.${index}.estimatedDuration`)}
                    />
                  </td>
                  <td className={cellClass}>
                    <Input type="text" {...register(`items.${index}.sparesConsumablesIncluded`)} />
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
