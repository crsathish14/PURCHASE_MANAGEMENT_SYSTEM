"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_PRIORITY } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import {
  buildCreateRequisitionSchema,
  type CreateRequisitionFormValues,
} from "@/lib/validation/purchase-requisition";
import { toast } from "@/store/toast-store";
import { AskLabelDialog } from "./ask-label-dialog";
import { LineItemsField } from "./line-items-field";

const t = en.staff.poRequests.createDialog;
const askLabelT = en.staff.poRequests.askLabelDialog;

export type CreateRequisitionDialogProps = {
  open: boolean;
  onClose: () => void;
  dropdownFields: PrDropdownField[];
  onCreated: () => void;
};

export function CreateRequisitionDialog({
  open,
  onClose,
  dropdownFields,
  onCreated,
}: CreateRequisitionDialogProps) {
  const schema = useMemo(() => buildCreateRequisitionSchema(dropdownFields), [dropdownFields]);

  const defaultValues = useMemo<CreateRequisitionFormValues>(
    () => ({
      priority: "",
      dropdowns: Object.fromEntries(dropdownFields.map((field) => [field.key, ""])),
      requestedBy: "",
      requiredPort: "",
      remarks: "",
      customFields: [],
      columns: [],
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
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
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

  const {
    fields: columns,
    append: appendColumn,
    remove: removeColumn,
  } = useFieldArray({
    control,
    name: "columns",
  });

  const [addFieldOpen, setAddFieldOpen] = useState(false);

  const watchedDropdowns = watch("dropdowns");
  const priority = watch("priority");
  const requiredFieldsFilled =
    Boolean(priority) && dropdownFields.every((field) => watchedDropdowns?.[field.key]);
  const hasErrors = Object.keys(errors).length > 0;

  function close() {
    onClose();
    reset(defaultValues);
  }

  async function onSubmit(data: CreateRequisitionFormValues) {
    try {
      const response = await fetch("/api/purchase-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.createError);
        return;
      }

      toast.success(t.createSuccess);
      close();
      onCreated();
    } catch {
      toast.error(t.createError);
    }
  }

  return (
    <Dialog open={open} onClose={close} title={t.title} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Two columns for every field except line items — CSS grid auto-flow
            handles pairing regardless of how many dynamic dropdowns/custom
            fields end up in the list, unlike manually paired flex rows. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label htmlFor="pr-priority" error={!!errors.priority}>
              {t.priority}
            </Label>
            <Select id="pr-priority" error={errors.priority?.message} {...register("priority")}>
              <option value="" disabled>
                {t.selectPlaceholder}
              </option>
              <option value={PR_PRIORITY.HIGH}>{t.priorityOptions.high}</option>
              <option value={PR_PRIORITY.MEDIUM}>{t.priorityOptions.medium}</option>
              <option value={PR_PRIORITY.LOW}>{t.priorityOptions.low}</option>
            </Select>
          </div>

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
          columns={columns}
          appendColumn={appendColumn}
          removeColumn={removeColumn}
        />

        <div className="mt-5">
          <Label htmlFor="pr-remarks">
            {t.remarks} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Textarea id="pr-remarks" placeholder={t.remarksPlaceholder} {...register("remarks")} />
        </div>

        <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={!requiredFieldsFilled || hasErrors}
          >
            {isSubmitting ? t.submitting : t.submit}
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
