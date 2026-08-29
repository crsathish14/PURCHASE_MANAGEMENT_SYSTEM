"use client";

import { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";

import { Button, Dialog, Input, Label, Select, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_CATEGORY, PR_PRIORITY, PR_STATUS } from "@/lib/constants/purchase-requisition";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import type { PrDetail, PrDropdownField } from "@/lib/data/purchase-requisition";
import { createClient } from "@/lib/supabase/client";
import {
  buildCreateRequisitionSchema,
  todayDateString,
  type CreateRequisitionFormValues,
} from "@/lib/validation/purchase-requisition";
import { toast } from "@/store/toast-store";
import { AskLabelDialog } from "./ask-label-dialog";
import { LineItemsField } from "./line-items-field";

const t = en.staff.poRequests.createDialog;
const askLabelT = en.staff.poRequests.askLabelDialog;

// The <form> lives inside Dialog's scrollable body, but its submit/cancel
// buttons render in Dialog's separate sticky `footer` slot — outside the
// form's own DOM subtree. The HTML `form` attribute (used on the submit
// Button below) associates a button with a <form> by id regardless of DOM
// nesting, which is what keeps handleSubmit wired up across that split.
const FORM_ID = "create-requisition-form";

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
  // Create-mode only: a parsed import-template's values, used to seed
  // defaultValues instead of the all-blank create form. Distinct from
  // `requisition` since that's server-shaped (PrDetail, with id/status/etc.)
  // while this is raw, still-unsaved form values — the user still reviews and
  // Submits normally, nothing is written until they do.
  initialImportValues?: Partial<CreateRequisitionFormValues> | null;
};

export function CreateRequisitionDialog({
  open,
  onClose,
  dropdownFields,
  onSaved,
  requisition = null,
  initialImportValues = null,
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
      const blank: CreateRequisitionFormValues = {
        priority: "",
        dropdowns: Object.fromEntries(dropdownFields.map((field) => [field.key, ""])),
        requestedBy: "",
        requiredPort: "",
        requisitionNumber: "",
        requisitionDate: "",
        title: "",
        remarks: "",
        equipmentName: "",
        equipmentType: "",
        equipmentMake: "",
        equipmentSerialNo: "",
        equipmentModel: "",
        equipmentSpecifications: "",
        equipmentOtherDetails: "",
        customFields: [],
        columns: [],
        lineItems: [{ description: "", qty: "", extra: {}, attachments: [] }],
      };
      // A shallow merge is correct here: a scalar field (priority, title, ...)
      // either comes from the import or falls back to blank, and an array/
      // record field the parser did include (dropdowns, columns, lineItems)
      // is meant to fully replace the blank default, not merge entry-by-entry.
      return initialImportValues ? { ...blank, ...initialImportValues } : blank;
    }
    const sourceLineItems =
      requisition.lineItems.length > 0
        ? requisition.lineItems
        : [{ description: "", qty: "", extra: {}, attachments: [] }];
    return {
      priority: requisition.priority,
      dropdowns: Object.fromEntries(
        dropdownFields.map((field) => [field.key, requisition.dropdowns[field.key] ?? ""]),
      ),
      requestedBy: requisition.requestedBy ?? "",
      requiredPort: requisition.requiredPort ?? "",
      requisitionNumber: requisition.requisitionNumber ?? "",
      requisitionDate: requisition.requisitionDate ?? "",
      title: requisition.title ?? "",
      remarks: requisition.remarks ?? "",
      equipmentName: requisition.equipmentName ?? "",
      equipmentType: requisition.equipmentType ?? "",
      equipmentMake: requisition.equipmentMake ?? "",
      equipmentSerialNo: requisition.equipmentSerialNo ?? "",
      equipmentModel: requisition.equipmentModel ?? "",
      equipmentSpecifications: requisition.equipmentSpecifications ?? "",
      equipmentOtherDetails: requisition.equipmentOtherDetails ?? "",
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
        attachments: item.attachments,
      })),
    };
  }, [dropdownFields, requisition, initialImportValues]);

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

  // Top-level Storage path folder for any photos uploaded in this dialog
  // session, when creating a brand-new requisition (no real id exists yet
  // until Submit). po-requests-view.tsx keys this dialog `key={editingRequisition?.id
  // ?? "create"}` — a constant "create" in create mode — so the instance does
  // NOT remount between repeated Cancel -> reopen cycles; the token is
  // regenerated explicitly in close() below so each create session gets its
  // own Storage folder rather than silently reusing the previous one.
  const [draftToken, setDraftToken] = useState(() => crypto.randomUUID());
  // requisition present (edit or readOnly) => its real, stable id;
  // otherwise (create) => this session's draft token.
  const scopeId = requisition ? requisition.id : draftToken;

  // Every Storage path a photo upload has completed to during this dialog
  // session (populated via LineItemsField's onPhotoUploaded, regardless of
  // whether that photo is later removed again or the dialog is cancelled
  // outright). close() diffs this against whatever actually got saved and
  // best-effort deletes the rest — the accepted "delete on close" cleanup
  // for the pick-uploads-immediately design (see the RPCs' own comments on
  // why a DB row can't exist until Submit).
  const sessionUploadedPathsRef = useRef<Set<string>>(new Set());

  // The requisition's already-saved attachment paths as loaded (edit mode
  // only — empty in create mode). update_purchase_requisition drops every
  // existing attachment row and reinserts only what's in the submit payload
  // (see that RPC's own header comment), so any of these missing from
  // confirmedPaths after a successful save was deliberately removed by the
  // user — those Storage objects are cleaned up alongside session-uploaded
  // orphans in onSubmit below. Never touched on a plain Cancel: the DB rows
  // (and their Storage objects) are still live and referenced until a save
  // actually goes through.
  const originalAttachmentPaths = useMemo(
    () => requisition?.lineItems.flatMap((item) => item.attachments.map((a) => a.storagePath)) ?? [],
    [requisition],
  );

  const watchedDropdowns = watch("dropdowns");
  const priority = watch("priority");
  const requiredFieldsFilled =
    Boolean(priority) && dropdownFields.every((field) => watchedDropdowns?.[field.key]);
  const hasErrors = Object.keys(errors).length > 0;

  // confirmedPaths = paths that made it into a just-successful save (absent
  // on a plain Cancel, so every session-uploaded path is orphaned then).
  // extraCandidatePaths = originalAttachmentPaths, passed only from onSubmit
  // on a successful edit save — never on Cancel, since an un-saved removal
  // must leave the still-live DB row's Storage object alone.
  // Best-effort only: never blocks the close, and a failure here just means
  // the object waits for a future reconciliation sweep instead — see
  // plans around "Known v1 limitations" for the RPC/Storage design.
  function close(confirmedPaths?: Set<string>, extraCandidatePaths: string[] = []) {
    const candidatePaths = new Set([...sessionUploadedPathsRef.current, ...extraCandidatePaths]);
    const orphanedPaths = [...candidatePaths].filter((path) => !confirmedPaths?.has(path));
    if (orphanedPaths.length > 0) {
      void createClient()
        .storage.from(STORAGE_BUCKET.ATTACHMENTS)
        .remove(orphanedPaths)
        .then(({ error }) => {
          if (error) console.error("[create-requisition-dialog] orphaned photo cleanup failed", error);
        });
    }
    sessionUploadedPathsRef.current = new Set();
    onClose();
    reset(defaultValues);
    setDraftToken(crypto.randomUUID());
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
      const confirmedPaths = new Set(
        data.lineItems.flatMap((item) => item.attachments.map((a) => a.storagePath)),
      );
      close(confirmedPaths, originalAttachmentPaths);
    } catch {
      toast.error(mode === "edit" ? t.updateError : t.createError);
    }
  }

  const title = mode === "create" ? t.title : mode === "edit" ? t.editTitle : t.viewTitle;

  return (
    <Dialog
      open={open}
      onClose={() => close()}
      title={title}
      size="lg"
      footer={
        readOnly ? (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => close()}>
              {t.close}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => close()}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
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
          </div>
        )
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Two columns for every field except line items — CSS grid auto-flow
            handles pairing regardless of how many dynamic dropdowns/custom
            fields end up in the list, unlike manually paired flex rows. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Label htmlFor="pr-requisition-number" error={!!errors.requisitionNumber}>
              {t.requisitionNumber}
            </Label>
            <Input
              id="pr-requisition-number"
              type="text"
              placeholder={t.requisitionNumberPlaceholder}
              disabled={readOnly}
              error={errors.requisitionNumber?.message}
              {...register("requisitionNumber")}
            />
          </div>

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

          {dropdownFields.map((field) => {
            // Category is immutable once a requisition exists — locked as
            // soon as mode isn't "create", even while everything else stays
            // editable during pending_rfq. update_purchase_requisition
            // independently rejects a changed category too (defense against
            // a direct API call), so this disabled state is UI-convenience,
            // not the only enforcement.
            const categoryLocked = field.key === "category" && mode !== "create";
            return (
              <div key={field.key}>
                <Label htmlFor={`pr-dropdown-${field.key}`} error={!!errors.dropdowns?.[field.key]}>
                  {field.label}
                  {categoryLocked && !readOnly ? (
                    <span className="ml-1.5 font-normal text-slate-lt">{t.categoryLocked}</span>
                  ) : null}
                </Label>
                <Select
                  id={`pr-dropdown-${field.key}`}
                  disabled={readOnly || categoryLocked}
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
            );
          })}

          <div>
            <Label htmlFor="pr-requested-by" error={!!errors.requestedBy}>
              {t.requestedBy}
            </Label>
            <Input
              id="pr-requested-by"
              type="date"
              min={todayDateString()}
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

          <div>
            <Label htmlFor="pr-requisition-date" error={!!errors.requisitionDate}>
              {t.requisitionDate}
            </Label>
            <Input
              id="pr-requisition-date"
              type="date"
              disabled={readOnly}
              error={errors.requisitionDate?.message}
              {...register("requisitionDate")}
            />
          </div>

          <div>
            <Label htmlFor="pr-requisition-title" error={!!errors.title}>
              {t.requisitionTitle}
            </Label>
            <Input
              id="pr-requisition-title"
              type="text"
              placeholder={t.requisitionTitlePlaceholder}
              disabled={readOnly}
              error={errors.title?.message}
              {...register("title")}
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

        {/* Spares-only, per the source paper form's own note ("Each
            Requisition should be for one Equipment only") — placed above line
            items since it scopes them, matching that form's layout. Always
            optional; hidden (not just disabled) for every other category so
            its fields never confuse a Stores/Service submission, but their
            values stay in the form state either way (blank unless the user
            had switched into Spares and back). */}
        {watchedDropdowns?.category === PR_CATEGORY.SPARES ? (
          <div className="mt-5">
            <Label>{t.equipmentDetails.title}</Label>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-line p-4">
              <div>
                <Label htmlFor="pr-equipment-name">{t.equipmentDetails.nameOfEquipment}</Label>
                <Input id="pr-equipment-name" type="text" disabled={readOnly} {...register("equipmentName")} />
              </div>
              <div>
                <Label htmlFor="pr-equipment-type">{t.equipmentDetails.type}</Label>
                <Input id="pr-equipment-type" type="text" disabled={readOnly} {...register("equipmentType")} />
              </div>
              <div>
                <Label htmlFor="pr-equipment-make">{t.equipmentDetails.make}</Label>
                <Input id="pr-equipment-make" type="text" disabled={readOnly} {...register("equipmentMake")} />
              </div>
              <div>
                <Label htmlFor="pr-equipment-serial-no">{t.equipmentDetails.serialNo}</Label>
                <Input
                  id="pr-equipment-serial-no"
                  type="text"
                  disabled={readOnly}
                  {...register("equipmentSerialNo")}
                />
              </div>
              <div>
                <Label htmlFor="pr-equipment-model">{t.equipmentDetails.model}</Label>
                <Input id="pr-equipment-model" type="text" disabled={readOnly} {...register("equipmentModel")} />
              </div>
              <div />
              <div className="col-span-2">
                <Label htmlFor="pr-equipment-specifications">{t.equipmentDetails.specifications}</Label>
                <Textarea
                  id="pr-equipment-specifications"
                  disabled={readOnly}
                  {...register("equipmentSpecifications")}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="pr-equipment-other-details">{t.equipmentDetails.otherDetails}</Label>
                <Textarea
                  id="pr-equipment-other-details"
                  disabled={readOnly}
                  {...register("equipmentOtherDetails")}
                />
              </div>
            </div>
          </div>
        ) : null}

        <LineItemsField
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          unregister={unregister}
          columns={columns}
          appendColumn={appendColumn}
          removeColumn={removeColumn}
          category={watchedDropdowns?.category}
          readOnly={readOnly}
          scopeId={scopeId}
          onPhotoUploaded={(path) => sessionUploadedPathsRef.current.add(path)}
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
