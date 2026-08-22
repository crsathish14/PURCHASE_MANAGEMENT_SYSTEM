"use client";

import { useState } from "react";
import {
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormUnregister,
} from "react-hook-form";
import { X } from "lucide-react";

import { Button, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import type { CreateRequisitionFormValues } from "@/lib/validation/purchase-requisition";
import { AskLabelDialog } from "./ask-label-dialog";

const t = en.staff.poRequests.createDialog;
const askLabelT = en.staff.poRequests.askLabelDialog;

// A column's label is display metadata, not a submitted value with its own
// validation rule — so column definitions live in plain useState, not in
// react-hook-form state. Only the per-row *values* (registered under
// lineItems.{index}.extra.{column.key}) are RHF-managed.
type LineItemColumn = { key: string; label: string };

type LineItemsFieldProps = {
  control: Control<CreateRequisitionFormValues>;
  register: UseFormRegister<CreateRequisitionFormValues>;
  errors: FieldErrors<CreateRequisitionFormValues>;
  setValue: UseFormSetValue<CreateRequisitionFormValues>;
  unregister: UseFormUnregister<CreateRequisitionFormValues>;
};

export function LineItemsField({ control, register, errors, setValue, unregister }: LineItemsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const [columns, setColumns] = useState<LineItemColumn[]>([]);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  function handleAddColumn(label: string) {
    const key = crypto.randomUUID();
    setColumns((prev) => [...prev, { key, label }]);
    // Backfill every existing row so its new input resolves to "" instead of undefined.
    fields.forEach((_, index) => {
      setValue(`lineItems.${index}.extra.${key}`, "");
    });
  }

  function handleRemoveColumn(key: string) {
    setColumns((prev) => prev.filter((column) => column.key !== key));
    fields.forEach((_, index) => {
      unregister(`lineItems.${index}.extra.${key}`);
    });
  }

  function handleAddItem() {
    // Seed every currently-known column so a new row's extra inputs are all registered.
    append({
      description: "",
      qty: "",
      extra: Object.fromEntries(columns.map((column) => [column.key, ""])),
    });
  }

  const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
  const cellClass = "px-2 py-1.5 align-top";

  return (
    <div className="mt-5">
      {/* "Add column" lives outside the table (not a <th>) so the table's own
          columns stay evenly aligned between the header row and every data row. */}
      <div className="mb-2 flex items-center justify-between">
        <Label>{t.lineItemsTitle}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAddColumnOpen(true)}>
          {t.addColumn}
        </Button>
      </div>

      <table className="mb-2 w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={headerCellClass}>{t.columns.description}</th>
            <th className={`${headerCellClass} w-28`}>{t.columns.qty}</th>
            {columns.map((column) => (
              <th key={column.key} className={headerCellClass}>
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  <button
                    type="button"
                    aria-label={t.removeColumn}
                    onClick={() => handleRemoveColumn(column.key)}
                    className="normal-case text-slate-lt hover:text-rust"
                  >
                    <X size={11} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </span>
              </th>
            ))}
            <th className={`${headerCellClass} w-10`} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td className={cellClass}>
                <Input
                  error={errors.lineItems?.[index]?.description?.message}
                  {...register(`lineItems.${index}.description`)}
                />
              </td>
              <td className={cellClass}>
                <Input
                  error={errors.lineItems?.[index]?.qty?.message}
                  {...register(`lineItems.${index}.qty`)}
                />
              </td>
              {columns.map((column) => (
                <td key={column.key} className={cellClass}>
                  <Input {...register(`lineItems.${index}.extra.${column.key}`)} />
                </td>
              ))}
              <td className={cellClass}>
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  aria-label={t.removeLineItem}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <X size={14} strokeWidth={1.7} aria-hidden="true" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Plain button, not the Button atom — none of its variants have the
          design's dashed-border "add item" treatment. */}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full rounded-md border border-dashed border-[#C9D2E0] py-2 text-center text-[12.5px] font-bold text-harbor hover:bg-harbor-50"
      >
        + {t.addItem}
      </button>

      <AskLabelDialog
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        title={askLabelT.columnTitle}
        onSubmit={handleAddColumn}
      />
    </div>
  );
}
