import type { Path, UseFormRegister } from "react-hook-form";

import { Input, Label } from "@/components/atoms";
import { VENDOR_QUOTE_CURRENCY } from "@/lib/constants/vendor-quote";
import type { RfqQuoteDetail } from "@/lib/data/rfq-quote";
import { displayValue } from "./format-display-value";

export type RfqDetailsSectionCopy = {
  title: string;
  vesselName: string;
  imoNo: string;
  dateOfIssue: string;
  requisitionNo: string;
  portOfDelivery: string;
  requiredDate: string;
  requestedCurrency: string;
  quotationNo: string;
  quotationNoPlaceholder: string;
  refNo: string;
  refNoPlaceholder: string;
};

type RfqDetailsSectionFields = {
  quotationNo: string;
  refNo: string;
};

export type RfqDetailsSectionProps<TFieldValues extends RfqDetailsSectionFields> = {
  t: RfqDetailsSectionCopy;
  detail: Pick<RfqQuoteDetail, "vesselLabel" | "vesselImoNo" | "requisitionDate" | "prNumber" | "requiredPort" | "requestedBy">;
  register: UseFormRegister<TFieldValues>;
  sectionHeadingClass: string;
};

// Extracted verbatim from stores-quote-form.tsx (pure lift, no behavior
// change) — identical across all 3 categories except the port label text
// (Stores/Spares say "Port / Place of Delivery", Service says "Port / Place
// of Service"), which the caller supplies via t.portOfDelivery.
export function RfqDetailsSection<TFieldValues extends RfqDetailsSectionFields>({
  t,
  detail,
  register,
  sectionHeadingClass,
}: RfqDetailsSectionProps<TFieldValues>) {
  return (
    <section>
      <h2 className={sectionHeadingClass}>{t.title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <Label>{t.vesselName}</Label>
          <Input disabled value={displayValue(detail.vesselLabel)} />
        </div>
        <div>
          <Label>{t.imoNo}</Label>
          <Input disabled value={displayValue(detail.vesselImoNo)} />
        </div>
        <div>
          <Label>{t.dateOfIssue}</Label>
          <Input disabled value={displayValue(detail.requisitionDate)} />
        </div>
        <div>
          <Label>{t.requisitionNo}</Label>
          <Input disabled value={detail.prNumber} />
        </div>
        <div>
          <Label>{t.portOfDelivery}</Label>
          <Input disabled value={displayValue(detail.requiredPort)} />
        </div>
        <div>
          <Label>{t.requiredDate}</Label>
          <Input disabled value={displayValue(detail.requestedBy)} />
        </div>
        <div>
          <Label>{t.requestedCurrency}</Label>
          <Input disabled value={VENDOR_QUOTE_CURRENCY} />
        </div>
        <div />
        <div>
          <Label htmlFor="quote-quotation-no">{t.quotationNo}</Label>
          <Input
            id="quote-quotation-no"
            type="text"
            placeholder={t.quotationNoPlaceholder}
            {...register("quotationNo" as Path<TFieldValues>)}
          />
        </div>
        <div>
          <Label htmlFor="quote-ref-no">{t.refNo}</Label>
          <Input
            id="quote-ref-no"
            type="text"
            placeholder={t.refNoPlaceholder}
            {...register("refNo" as Path<TFieldValues>)}
          />
        </div>
      </div>
    </section>
  );
}
