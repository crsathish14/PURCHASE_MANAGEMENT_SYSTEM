"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_PRIORITY, PR_STATUS } from "@/lib/constants/purchase-requisition";
import type { PrDetail, PrDropdownField } from "@/lib/data/purchase-requisition";
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
  onSaved: () => void;
  // Absent = create a new PR. Present = edit (while pending_rfq) or
  // read-only viewing (every other status) of an existing one — the parent
  // renders this dialog with a `key` derived from requisition?.id so
  // switching rows remounts it and defaultValues reinitialize cleanly.
  requisition?: PrDetail | null;
};

export function CreateRequisitionDialog({
  open,
  onClose,
  dropdownFields,
  onSaved,
  requisition = null,
}: CreateRequisitionDialogProps) {
  const mode: "create" | "edit" | "readOnly" = !requisition
    ? "create"
    : requisition.status === PR_STATUS.PENDING_RFQ
      ? "edit"
      : "readOnly";
  const readOnly = mode === "readOnly";

  const schema = useMemo(() => buildCreateRequisitionSchema(dropdownFields), [dropdownFields]);

  const defaultValues = useMemo<CreateRequisitionFormValues>(() => {
    if (!requisition) {
      return {
        priority: "",
        dropdowns: Object.fromEntries(dropdownFields.map((field) => [field.key, ""])),
        requestedBy: "",
        requiredPort: "",
        remarks: "",
        customFields: [],
        columns: [],
        lineItems: [{ description: "", qty: "", extra: {} }],
      };
    }
    const sourceLineItems =
      requisition.lineItems.length > 0 ? requisition.lineItems : [{ description: "", qty: "", extra: {} }];
    return {
      priority: requisition.priority,
      dropdowns: Object.fromEntries(
        dropdownFields.map((field) => [field.key, requisition.dropdowns[field.key] ?? ""]),
      ),
      requestedBy: requisition.requestedBy ?? "",
      requiredPort: requisition.requiredPort ?? "",
      remarks: requisition.remarks ?? "",
      customFields: requisition.customFields,
      columns: requisition.columns,
      // Backfill every line item's extra with every known column key so
      // each input starts controlled (register'd) instead of undefined.
      lineItems: sourceLineItems.map((item) => ({
        description: item.description,
        qty: item.qty,
        extra: Object.fromEntries(
          requisition.columns.map((column) => [column.key, item.extra[column.key] ?? ""]),
        ),
      })),
    };
  }, [dropdownFields, requisition]);

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
      const endpoint =
        mode === "edit" ? `/api/purchase-requisitions/${requisition!.id}` : "/api/purchase-requisitions";
      const method = mode === "edit" ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? (mode === "edit" ? t.updateError : t.createError));
        return;
      }

      toast.success(mode === "edit" ? t.updateSuccess : t.createSuccess);
      // onSaved() first, close() second — the parent's onSaved handler
      // (po-requests-view.tsx) reads its own `editingRequisition` state to
      // decide whether this was a create or an edit, and close() is what
      // clears that state via onClose().
      onSaved();
      close();
    } catch {
      toast.error(mode === "edit" ? t.updateError : t.createError);
    }
  }

  const title = mode === "create" ? t.title : mode === "edit" ? t.editTitle : t.viewTitle;

  return (
    <Dialog open={open} onClose={close} title={title} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Two columns for every field except line items — CSS grid auto-flow
            handles pairing regardless of how many dynamic dropdowns/custom
            fields end up in the list, unlike manually paired flex rows. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label htmlFor="pr-priority" error={!!errors.priority}>
              {t.priority}
            </Label>
            <Select
              id="pr-priority"
              disabled={readOnly}
              error={errors.priority?.message}
              {...register("priority")}
            >
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
                disabled={readOnly}
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
              disabled={readOnly}
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
              disabled={readOnly}
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
                disabled={readOnly}
                endAdornment={
                  readOnly ? undefined : (
                    <button
                      type="button"
                      aria-label={t.removeField}
                      onClick={() => removeCustomField(index)}
                      className="text-slate-lt hover:text-rust"
                    >
                      <X size={14} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  )
                }
                {...register(`customFields.${index}.value`)}
              />
            </div>
          ))}
        </div>

        {readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => setAddFieldOpen(true)}
          >
            <Plus size={13} strokeWidth={2} aria-hidden="true" />
            {t.addMoreField}
          </Button>
        )}

        <LineItemsField
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          unregister={unregister}
          columns={columns}
          appendColumn={appendColumn}
          removeColumn={removeColumn}
          readOnly={readOnly}
        />

        <div className="mt-5">
          <Label htmlFor="pr-remarks">
            {t.remarks} <span className="font-normal text-slate-lt">{t.optional}</span>
          </Label>
          <Textarea
            id="pr-remarks"
            placeholder={t.remarksPlaceholder}
            disabled={readOnly}
            {...register("remarks")}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2.5 border-t border-line pt-4">
          {readOnly ? (
            <Button type="button" variant="secondary" onClick={close}>
              {t.close}
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={close}>
                {t.cancel}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={!requiredFieldsFilled || hasErrors}
              >
                {mode === "edit"
                  ? isSubmitting
                    ? t.savingChanges
                    : t.saveChanges
                  : isSubmitting
                    ? t.submitting
                    : t.submit}
              </Button>
            </>
          )}
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
