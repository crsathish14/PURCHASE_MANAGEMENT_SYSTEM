import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";

import { Input, Label, Textarea } from "@/components/atoms";
import { formatCurrencyUsd } from "@/lib/format-currency";

export type QuotationSummarySectionCopy = {
  title: string;
  totalQuotedAmount: string;
  quotationValidity: string;
  quotationValidityPlaceholder: string;
  paymentTerms: string;
  paymentTermsPlaceholder: string;
  deliveryTerms: string;
  deliveryTermsPlaceholder: string;
  remarksNotes: string;
};

type QuotationSummarySectionFields = {
  quotationValidity: string;
  paymentTerms: string;
  deliveryTerms: string;
  remarksNotes: string;
};

export type QuotationSummarySectionProps<TFieldValues extends QuotationSummarySectionFields> = {
  t: QuotationSummarySectionCopy;
  grandTotal: number;
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  sectionHeadingClass: string;
};

// Extracted verbatim from stores-quote-form.tsx (pure lift, no behavior
// change) — byte-identical across all 3 categories, no per-category
// parametrization needed.
export function QuotationSummarySection<TFieldValues extends QuotationSummarySectionFields>({
  t,
  grandTotal,
  register,
  errors,
  sectionHeadingClass,
}: QuotationSummarySectionProps<TFieldValues>) {
  return (
    <section className="mt-8">
      <h2 className={sectionHeadingClass}>{t.title}</h2>
      <div className="mb-4">
        <Label>{t.totalQuotedAmount}</Label>
        <Input disabled value={formatCurrencyUsd(grandTotal)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <Label htmlFor="quote-validity" error={!!errors.quotationValidity}>
            {t.quotationValidity}
          </Label>
          <Input
            id="quote-validity"
            type="text"
            placeholder={t.quotationValidityPlaceholder}
            error={errors.quotationValidity?.message as string | undefined}
            {...register("quotationValidity" as Path<TFieldValues>)}
          />
        </div>
        <div>
          <Label htmlFor="quote-payment-terms" error={!!errors.paymentTerms}>
            {t.paymentTerms}
          </Label>
          <Input
            id="quote-payment-terms"
            type="text"
            placeholder={t.paymentTermsPlaceholder}
            error={errors.paymentTerms?.message as string | undefined}
            {...register("paymentTerms" as Path<TFieldValues>)}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="quote-delivery-terms" error={!!errors.deliveryTerms}>
            {t.deliveryTerms}
          </Label>
          <Input
            id="quote-delivery-terms"
            type="text"
            placeholder={t.deliveryTermsPlaceholder}
            error={errors.deliveryTerms?.message as string | undefined}
            {...register("deliveryTerms" as Path<TFieldValues>)}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="quote-remarks-notes" error={!!errors.remarksNotes}>
            {t.remarksNotes}
          </Label>
          <Textarea
            id="quote-remarks-notes"
            error={errors.remarksNotes?.message as string | undefined}
            {...register("remarksNotes" as Path<TFieldValues>)}
          />
        </div>
      </div>
    </section>
  );
}
