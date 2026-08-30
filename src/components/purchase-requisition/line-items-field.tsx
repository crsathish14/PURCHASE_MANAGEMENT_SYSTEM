"use client";

import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormUnregister,
} from "react-hook-form";
import { X } from "lucide-react";

import { Button, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import { getPresetColumnsForCategory } from "@/lib/purchase-requisition/preset-columns";
import type { CreateRequisitionFormValues } from "@/lib/validation/purchase-requisition";
import { AskLabelDialog } from "./ask-label-dialog";
import { LineItemPhotosField } from "./line-item-photos-field";

const t = en.staff.poRequests.createDialog;
const askLabelT = en.staff.poRequests.askLabelDialog;

// Column *definitions* live on the parent form's own "columns" field array
// (not local state here) — the POST payload needs each column's label, which
// only ever lives here, never inside a row's "extra" values.
type LineItemColumn = { key: string; label: string };

type LineItemsFieldProps = {
  control: Control<CreateRequisitionFormValues>;
  register: UseFormRegister<CreateRequisitionFormValues>;
  errors: FieldErrors<CreateRequisitionFormValues>;
  setValue: UseFormSetValue<CreateRequisitionFormValues>;
  unregister: UseFormUnregister<CreateRequisitionFormValues>;
  columns: Array<LineItemColumn & { id: string }>;
  appendColumn: UseFieldArrayAppend<CreateRequisitionFormValues, "columns">;
  removeColumn: UseFieldArrayRemove;
  // The selected `category` dropdown value — drives which line-item columns
  // show (Service: description only; Stores/Spares: + Required Quantity,
  // Approved Qty, Remarks, Photos). Undefined before a category is picked,
  // treated the same as Stores/Spares (only Service is special-cased).
  category?: string;
  readOnly?: boolean;
  // Top-level Storage path folder for any photos uploaded in this form
  // session — a create-mode draft token or the real requisition.id in edit
  // mode. See create-requisition-dialog.tsx.
  scopeId: string;
  // Fired the moment a photo finishes uploading to Storage (i.e. it's newly
  // present in an attachments array that didn't have it before) — lets the
  // dialog track every path this session wrote, so it can best-effort delete
  // whichever ones never end up in a saved payload (Cancel, or removed again
  // before Submit). See create-requisition-dialog.tsx's sessionUploadedPathsRef.
  onPhotoUploaded?: (storagePath: string) => void;
};

export function LineItemsField({
  control,
  register,
  errors,
  setValue,
  unregister,
  columns,
  appendColumn,
  removeColumn,
  category,
  readOnly = false,
  scopeId,
  onPhotoUploaded,
}: LineItemsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const isService = category === PR_CATEGORY.SERVICE;
  const isStoresOrSpares = category === PR_CATEGORY.STORES || category === PR_CATEGORY.SPARES;

  function handleAddColumn(label: string, presetKey?: string) {
    const key = presetKey ?? crypto.randomUUID();
    appendColumn({ key, label });
    // Backfill every existing row so its new input resolves to "" instead of undefined.
    fields.forEach((_, index) => {
      setValue(`lineItems.${index}.extra.${key}`, "");
    });
  }

  function handleRemoveColumn(key: string) {
    const columnIndex = columns.findIndex((column) => column.key === key);
    if (columnIndex !== -1) removeColumn(columnIndex);
    fields.forEach((_, index) => {
      unregister(`lineItems.${index}.extra.${key}`);
    });
  }

  // Category is immutable once a requisition is created (see
  // create-requisition-dialog.tsx), so this only ever fires during the
  // create flow, before first save — never mid-edit.
  const prevCategoryRef = useRef(category);
  useEffect(() => {
    const prevCategory = prevCategoryRef.current;
    prevCategoryRef.current = category;
    // Never fires on mount (prevCategory === category the first time), so
    // loading an existing requisition never touches its saved columns just
    // by opening it.
    if (readOnly || prevCategory === category) return;

    // Match by stable key OR exact label — a preset column that's already
    // been saved and reloaded comes back with the column's real DB uuid as
    // its key (see getPurchaseRequisitionById), not the literal preset
    // string, so label-matching is what prevents a duplicate from being
    // appended in that case.
    const find = (key: string, label: string) => columns.find((c) => c.key === key || c.label === label);

    const prevSet = getPresetColumnsForCategory(prevCategory);
    const nextSet = getPresetColumnsForCategory(category);

    // Remove whatever the previous category's preset set had that the new
    // one doesn't (e.g. Stores' IMPA Code when switching into Spares).
    for (const preset of prevSet) {
      if (nextSet.some((p) => p.key === preset.key)) continue;
      const existing = find(preset.key, preset.label);
      if (existing) handleRemoveColumn(existing.key);
    }
    // Add whatever the new category's preset set has that wasn't already
    // there (e.g. Part No./Ref. No. when switching into Spares).
    for (const preset of nextSet) {
      if (!find(preset.key, preset.label)) handleAddColumn(preset.label, preset.key);
    }
    // Intentionally gated on category (+ readOnly) alone: columns/fields/
    // handleAddColumn/handleRemoveColumn must NOT be dependencies, otherwise
    // a user's own manual add/remove of any column (which changes `columns`
    // without changing `category`) would immediately re-run this effect and
    // undo their edit (e.g. re-add a preset column they just removed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, readOnly]);

  function handleAddItem() {
    // Seed every currently-known column so a new row's extra inputs are all registered.
    append({
      description: "",
      qty: "",
      extra: Object.fromEntries(columns.map((column) => [column.key, ""])),
      attachments: [],
    });
  }

  function handleRemoveItem(index: number) {
    // attachments live on the row's own RHF value now, so remove() already
    // drops them — no separate cleanup needed.
    remove(index);
  }

  const headerCellClass = "px-2 py-1.5 text-left font-mono text-[9.5px] font-bold tracking-wide text-slate-lt uppercase";
  const cellClass = "px-2 py-1.5 align-top";

  return (
    <div className="mt-5">
      {/* "Add column" lives outside the table (not a <th>) so the table's own
          columns stay evenly aligned between the header row and every data row. */}
      <div className="mb-2 flex items-center justify-between">
        <Label>{t.lineItemsTitle}</Label>
        {readOnly ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAddColumnOpen(true)}>
            {t.addColumn}
          </Button>
        )}
      </div>

      <table className="mb-2 w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={`${headerCellClass} w-85`}>{t.columns.description}</th>
            {isService ? null : <th className={`${headerCellClass} w-28`}>{t.columns.qty}</th>}
            {columns.map((column) => (
              <th key={column.key} className={headerCellClass}>
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  {readOnly ? null : (
                    <button
                      type="button"
                      aria-label={t.removeColumn}
                      onClick={() => handleRemoveColumn(column.key)}
                      className="normal-case text-slate-lt hover:text-rust"
                    >
                      <X size={11} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </th>
            ))}
            {isStoresOrSpares ? <th className={headerCellClass}>{t.columns.photos}</th> : null}
            {readOnly ? null : <th className={`${headerCellClass} w-10`} aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td className={cellClass}>
                <Input
                  disabled={readOnly}
                  error={errors.lineItems?.[index]?.description?.message}
                  {...register(`lineItems.${index}.description`)}
                />
              </td>
              {isService ? null : (
                <td className={cellClass}>
                  <Input
                    disabled={readOnly}
                    error={errors.lineItems?.[index]?.qty?.message}
                    {...register(`lineItems.${index}.qty`)}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key} className={cellClass}>
                  <Input disabled={readOnly} {...register(`lineItems.${index}.extra.${column.key}`)} />
                </td>
              ))}
              {isStoresOrSpares ? (
                <td className={cellClass}>
                  <Controller
                    control={control}
                    name={`lineItems.${index}.attachments`}
                    render={({ field: attachmentsField }) => (
                      <LineItemPhotosField
                        scopeId={scopeId}
                        lineItemFieldId={field.id}
                        value={attachmentsField.value}
                        onChange={(next) => {
                          if (onPhotoUploaded) {
                            const prevPaths = new Set(attachmentsField.value.map((a) => a.storagePath));
                            next.forEach((a) => {
                              if (!prevPaths.has(a.storagePath)) onPhotoUploaded(a.storagePath);
                            });
                          }
                          attachmentsField.onChange(next);
                        }}
                        disabled={readOnly}
                      />
                    )}
                  />
                </td>
              ) : null}
              {readOnly ? null : (
                <td className={cellClass}>
                  <Button
                    type="button"
                    variant="icon"
                    size="sm"
                    aria-label={t.removeLineItem}
                    disabled={fields.length === 1}
                    onClick={() => handleRemoveItem(index)}
                  >
                    <X size={14} strokeWidth={1.7} aria-hidden="true" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Plain button, not the Button atom — none of its variants have the
          design's dashed-border "add item" treatment. */}
      {readOnly ? null : (
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full rounded-md border border-dashed border-[#C9D2E0] py-2 text-center text-[12.5px] font-bold text-harbor hover:bg-harbor-50"
        >
          + {t.addItem}
        </button>
      )}

      <AskLabelDialog
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        title={askLabelT.columnTitle}
        onSubmit={handleAddColumn}
      />
    </div>
  );
}
