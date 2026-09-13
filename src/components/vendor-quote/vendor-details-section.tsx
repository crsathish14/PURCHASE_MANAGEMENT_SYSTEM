import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";

import { Input, Label, Textarea } from "@/components/atoms";

export type VendorDetailsSectionCopy = {
  title: string;
  vendorName: string;
  vendorNamePlaceholder: string;
  contactPerson: string;
  contactNo: string;
  email: string;
  otherDetails: string;
  optional: string;
};

type VendorDetailsSectionFields = {
  vendorName: string;
  vendorContactPerson: string;
  vendorContactNo: string;
  vendorEmail: string;
  vendorOtherDetails: string;
};

export type VendorDetailsSectionProps<TFieldValues extends VendorDetailsSectionFields> = {
  t: VendorDetailsSectionCopy;
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  sectionHeadingClass: string;
};

// Extracted verbatim from stores-quote-form.tsx (pure lift, no behavior
// change) — byte-identical across all 3 categories, no per-category
// parametrization needed.
export function VendorDetailsSection<TFieldValues extends VendorDetailsSectionFields>({
  t,
  register,
  errors,
  sectionHeadingClass,
}: VendorDetailsSectionProps<TFieldValues>) {
  return (
    <section className="mt-8">
      <h2 className={sectionHeadingClass}>{t.title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <Label htmlFor="quote-vendor-name" error={!!errors.vendorName}>
            {t.vendorName}
          </Label>
          <Input
            id="quote-vendor-name"
            type="text"
            placeholder={t.vendorNamePlaceholder}
            error={errors.vendorName?.message as string | undefined}
            {...register("vendorName" as Path<TFieldValues>)}
          />
        </div>
        <div>
          <Label htmlFor="quote-contact-person">
            {t.contactPerson} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Input id="quote-contact-person" type="text" {...register("vendorContactPerson" as Path<TFieldValues>)} />
        </div>
        <div>
          <Label htmlFor="quote-contact-no">
            {t.contactNo} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Input id="quote-contact-no" type="text" {...register("vendorContactNo" as Path<TFieldValues>)} />
        </div>
        <div>
          <Label htmlFor="quote-vendor-email" error={!!errors.vendorEmail}>
            {t.email} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Input
            id="quote-vendor-email"
            type="email"
            error={errors.vendorEmail?.message as string | undefined}
            {...register("vendorEmail" as Path<TFieldValues>)}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="quote-vendor-other-details">
            {t.otherDetails} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Textarea id="quote-vendor-other-details" {...register("vendorOtherDetails" as Path<TFieldValues>)} />
        </div>
      </div>
    </section>
  );
}
