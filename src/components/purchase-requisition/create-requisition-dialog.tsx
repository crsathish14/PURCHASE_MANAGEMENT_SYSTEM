"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";

import { Button, Dialog, Input, Label, Select } from "@/components/atoms";
import en from "@/locales/en.json";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import {
  buildCreateRequisitionSchema,
  type CreateRequisitionFormValues,
} from "@/lib/validation/purchase-requisition";
import { AskLabelDialog } from "./ask-label-dialog";
import { LineItemsField } from "./line-items-field";

const t = en.staff.poRequests.createDialog;
const askLabelT = en.staff.poRequests.askLabelDialog;

export type CreateRequisitionDialogProps = {
  open: boolean;
  onClose: () => void;
  dropdownFields: PrDropdownField[];
};

export function CreateRequisitionDialog({ open, onClose, dropdownFields }: CreateRequisitionDialogProps) {
  const schema = useMemo(() => buildCreateRequisitionSchema(dropdownFields), [dropdownFields]);

  const defaultValues = useMemo<CreateRequisitionFormValues>(
    () => ({
      dropdowns: Object.fromEntries(dropdownFields.map((field) => [field.key, ""])),
      requestedBy: "",
      requiredPort: "",
      customFields: [],
      lineItems: [{ description: "", qty: "", extra: {} }],
    }),
    [dropdownFields],
  );

  const {
    register,
    control,
    setValue,
    unregister,
    reset,
    formState: { errors },
  } = useForm<CreateRequisitionFormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues,
  });

  const {
    fields: customFields,
    append: appendCustomField,
    remove: removeCustomField,
  } = useFieldArray({
    control,
    name: "customFields",
  });

  const [addFieldOpen, setAddFieldOpen] = useState(false);

  function close() {
    onClose();
    reset(defaultValues);
  }

  return (
    <Dialog open={open} onClose={close} title={t.title} size="lg">
      {/* No RHF handleSubmit — there's no backend to submit to yet (see the
          footer below), so nothing triggers this; preventDefault just guards
          against a stray native form submission. */}
      <form noValidate onSubmit={(event) => event.preventDefault()}>
        {/* Two columns for every field except line items — CSS grid auto-flow
            handles pairing regardless of how many dynamic dropdowns/custom
            fields end up in the list, unlike manually paired flex rows. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {dropdownFields.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`pr-dropdown-${field.key}`} error={!!errors.dropdowns?.[field.key]}>
                {field.label}
              </Label>
              <Select
                id={`pr-dropdown-${field.key}`}
                error={errors.dropdowns?.[field.key]?.message}
                {...register(`dropdowns.${field.key}`)}
              >
                <option value="" disabled>
                  {t.selectPlaceholder}
                </option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}

          <div>
            <Label htmlFor="pr-requested-by" error={!!errors.requestedBy}>
              {t.requestedBy}
            </Label>
            <Input
              id="pr-requested-by"
              type="date"
              error={errors.requestedBy?.message}
              {...register("requestedBy")}
            />
          </div>

          <div>
            <Label htmlFor="pr-required-port" error={!!errors.requiredPort}>
              {t.requiredPort}
            </Label>
            <Input
              id="pr-required-port"
              type="text"
              placeholder={t.requiredPortPlaceholder}
              error={errors.requiredPort?.message}
              {...register("requiredPort")}
            />
          </div>

          {customFields.map((field, index) => (
            <div key={field.id}>
              <Label htmlFor={`pr-custom-${index}`}>{field.label}</Label>
              <Input
                id={`pr-custom-${index}`}
                type="text"
                endAdornment={
                  <button
                    type="button"
                    aria-label={t.removeField}
                    onClick={() => removeCustomField(index)}
                    className="text-slate-lt hover:text-rust"
                  >
                    <X size={14} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                }
                {...register(`customFields.${index}.value`)}
              />
            </div>
          ))}
        </div>

        <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => setAddFieldOpen(true)}>
          <Plus size={13} strokeWidth={2} aria-hidden="true" />
          {t.addMoreField}
        </Button>

        <LineItemsField
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          unregister={unregister}
        />

        <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </form>

      <AskLabelDialog
        open={addFieldOpen}
        onClose={() => setAddFieldOpen(false)}
        title={askLabelT.fieldTitle}
        onSubmit={(label) => {
          appendCustomField({ label, value: "" });
          setAddFieldOpen(false);
        }}
      />
    </Dialog>
  );
}
