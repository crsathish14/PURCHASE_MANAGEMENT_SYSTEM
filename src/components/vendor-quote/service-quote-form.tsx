"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Input } from "@/components/atoms";
import en from "@/locales/en.json";
import type { RfqQuoteDetail, RfqQuoteLineItemsPage } from "@/lib/data/rfq-quote";
import { formatCurrencyUsd } from "@/lib/format-currency";
import { BLANK_SERVICE_ITEM_FIELDS, submitServiceVendorQuoteSchema, type SubmitServiceVendorQuoteInput } from "@/lib/validation/vendor-quote";
import { applyDraftHeader, type QuoteDraftState } from "@/lib/vendor-quote/draft";
import { toast } from "@/store/toast-store";
import { EquipmentDetailsSection } from "./equipment-details-section";
import { ItemPhotos } from "./item-photos";
import { LineItemsPager } from "./line-items-pager";
import { QuoteDraftStatus } from "./quote-draft-status";
import { QuotationSummarySection } from "./quotation-summary-section";
import { RfqDetailsSection } from "./rfq-details-section";
import { mergeLoadedPhotos, useQuoteDraftAutosave, type PhotosById } from "./use-quote-draft";
import { buildPageItems, useQuoteLineItemPages } from "./use-quote-line-item-pages";
import { VendorDetailsSection } from "./vendor-details-section";
import { VendorItemPhotosField } from "./vendor-item-photos-field";

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
  // The first page of line items, loaded on the server. Later pages are fetched
  // as the vendor pages through them (see useQuoteLineItemPages).
  initialPage: RfqQuoteLineItemsPage;
  // The vendor's auto-saved header values, if they'd started this quote before.
  initialDraft: QuoteDraftState | null;
};

export function ServiceQuoteForm({ token, detail, initialPage, initialDraft }: ServiceQuoteFormProps) {
  const [submitted, setSubmitted] = useState(false);
  // Not RHF-registered (see vendor-item-photos-field.tsx). Tracked by line item
  // id because the form holds one page of line items at a time, and saved to
  // the draft along with everything else.
  const [photosById, setPhotosById] = useState<PhotosById>(() => mergeLoadedPhotos({}, initialPage.lineItems));

  // react-hook-form holds only the line items on screen (the first page here),
  // seeded from the vendor's saved entries; the header is overlaid with the
  // saved draft header. RHF reads defaultValues once, at construction.
  const defaultValues = useMemo<SubmitServiceVendorQuoteInput>(
    () =>
      applyDraftHeader(
        {
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
          items: buildPageItems<SubmitServiceVendorQuoteInput["items"][number]>(initialPage.lineItems, BLANK_SERVICE_ITEM_FIELDS),
        },
        initialDraft?.header ?? null,
      ),
    [detail, initialPage, initialDraft],
  );

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<SubmitServiceVendorQuoteInput>({
    resolver: zodResolver(submitServiceVendorQuoteSchema),
    mode: "onBlur",
    defaultValues,
  });

  const draft = useQuoteDraftAutosave({
    token,
    watch,
    getValues,
    photosById,
    initialSavedAt: initialDraft?.savedAt ?? null,
    enabled: !submitted,
  });

  const pages = useQuoteLineItemPages<SubmitServiceVendorQuoteInput>({
    token,
    initialPage,
    blankFields: BLANK_SERVICE_ITEM_FIELDS,
    getValues,
    reset,
    saveNow: draft.saveNow,
    runSilently: draft.runSilently,
    onLoaded: (lineItems) => setPhotosById((prev) => mergeLoadedPhotos(prev, lineItems)),
  });

  const [vendorName, quotationValidity, paymentTerms, deliveryTerms] = watch([
    "vendorName",
    "quotationValidity",
    "paymentTerms",
    "deliveryTerms",
  ]);
  const requiredFieldsFilled = Boolean(vendorName && quotationValidity && paymentTerms && deliveryTerms);
  const hasErrors = Object.keys(errors).length > 0;

  // Deliberately NOT useMemo: react-hook-form's watch("items") does not
  // reliably return a referentially-new array on every change, so a useMemo
  // keyed on that reference silently never recomputes after the first render.
  // Recomputed on every render instead — a cheap map + arithmetic over one
  // page of line items.
  const watchedItems = watch("items");
  const rowTotals = pages.lineItems.map((_item, index) => {
    const unitPriceRaw = watchedItems?.[index]?.unitPrice ?? "";
    return parseUnitPrice(unitPriceRaw);
  });
  // Rows on other pages aren't loaded; the server totals them from the saved draft.
  const grandTotal = pages.otherPagesTotal + rowTotals.reduce((sum: number, value) => sum + (value ?? 0), 0);

  // The form holds only the visible page, so submit works from the saved draft:
  // flush it, then the server assembles every line item from it, validates the
  // whole quote, and submits. A failing row is usually on a page the vendor
  // isn't viewing — the server says which, and the form jumps there.
  async function onSubmit() {
    if (!(await draft.saveNow({ force: true }))) {
      toast.error(tCommon.pagination.saveBeforeSubmit);
      return;
    }

    try {
      const response = await fetch(`/api/quote/${token}/submit`, { method: "POST" });
      const responseBody = await response.json();

      if (!response.ok) {
        toast.error(responseBody?.error?.message ?? tCommon.submitError);
        const failingIndex = responseBody?.error?.firstErrorItemIndex;
        if (typeof failingIndex === "number" && (await pages.goToIndex(failingIndex))) await trigger();
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

      <section ref={pages.sectionRef} className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className={sectionHeadingClass}>{t.itemDetails.title}</h2>
          <div className="mb-3">
            <QuoteDraftStatus state={draft.state} />
          </div>
        </div>
        {pages.lineItems.map((item, index) => (
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
              {pages.lineItems.map((item, index) => (
                <tr key={item.lineItemId} className="border-b border-line last:border-b-0">
                  <td className={cellClass}>{pages.start + index + 1}</td>
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
                      value={photosById[item.lineItemId] ?? []}
                      onChange={(update) => {
                        setPhotosById((prev) => ({ ...prev, [item.lineItemId]: update(prev[item.lineItemId] ?? []) }));
                        draft.notifyPhotosChanged(item.lineItemId);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LineItemsPager pages={pages} />
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
