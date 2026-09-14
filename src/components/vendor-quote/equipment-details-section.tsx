import { Input, Label, Textarea } from "@/components/atoms";
import type { RfqQuoteDetail } from "@/lib/data/rfq-quote";
import { displayValue } from "./format-display-value";

export type EquipmentDetailsSectionCopy = {
  title: string;
  nameOfEquipment: string;
  type: string;
  make: string;
  serialNo: string;
  model: string;
  specifications: string;
  otherDetails: string;
};

export type EquipmentDetailsSectionProps = {
  t: EquipmentDetailsSectionCopy;
  detail: Pick<
    RfqQuoteDetail,
    | "equipmentName"
    | "equipmentType"
    | "equipmentMake"
    | "equipmentSerialNo"
    | "equipmentModel"
    | "equipmentSpecifications"
    | "equipmentOtherDetails"
  >;
  sectionHeadingClass: string;
};

// Spares + Service only — Stores PRs never populate equipment_* fields (see
// create-requisition-dialog.tsx's office-side Equipment Details section,
// which this mirrors layout-for-layout), so StoresQuoteForm doesn't render
// this at all. Every field is pre-filled and read-only for the vendor, same
// treatment as every other RFQ Details field.
export function EquipmentDetailsSection({ t, detail, sectionHeadingClass }: EquipmentDetailsSectionProps) {
  return (
    <section className="mt-8">
      <h2 className={sectionHeadingClass}>{t.title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-line p-4">
        <div>
          <Label>{t.nameOfEquipment}</Label>
          <Input disabled value={displayValue(detail.equipmentName)} />
        </div>
        <div>
          <Label>{t.type}</Label>
          <Input disabled value={displayValue(detail.equipmentType)} />
        </div>
        <div>
          <Label>{t.make}</Label>
          <Input disabled value={displayValue(detail.equipmentMake)} />
        </div>
        <div>
          <Label>{t.serialNo}</Label>
          <Input disabled value={displayValue(detail.equipmentSerialNo)} />
        </div>
        <div>
          <Label>{t.model}</Label>
          <Input disabled value={displayValue(detail.equipmentModel)} />
        </div>
        <div />
        <div className="col-span-2">
          <Label>{t.specifications}</Label>
          <Textarea disabled value={displayValue(detail.equipmentSpecifications)} />
        </div>
        <div className="col-span-2">
          <Label>{t.otherDetails}</Label>
          <Textarea disabled value={displayValue(detail.equipmentOtherDetails)} />
        </div>
      </div>
    </section>
  );
}
