import { z } from "zod";

import en from "@/locales/en.json";
import { PR_CATEGORY, PR_PRIORITY } from "@/lib/constants/purchase-requisition";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_LINE_ITEM,
  PR_LINE_ITEM_PHOTO_PATH_PREFIX,
} from "@/lib/constants/storage";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";

const t = en.staff.poRequests.errors;

// Local (not UTC) YYYY-MM-DD, matching the string an <input type="date">
// reports — comparable with plain string ordering since both sides share
// that fixed zero-padded format.
export function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export type CreateRequisitionFormValues = {
  priority: string;
  dropdowns: Record<string, string>;
  requestedBy: string;
  requiredPort: string;
  requisitionNumber: string;
  requisitionDate: string;
  title: string;
  remarks: string;
  // Spares-only ("Equipment Details" section) — kept as direct fields rather
  // than the generic customFields mechanism since these are fixed, known
  // concepts (not a user-invented label) that the import-template parser
  // must be able to map to deterministically every time. Always optional and
  // always present in the payload (blank when category isn't Spares), same
  // as requiredPort/remarks.
  equipmentName: string;
  equipmentType: string;
  equipmentMake: string;
  equipmentSerialNo: string;
  equipmentModel: string;
  equipmentSpecifications: string;
  equipmentOtherDetails: string;
  customFields: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string }>;
  lineItems: Array<{
    description: string;
    qty: string;
    extra: Record<string, string>;
    attachments: Array<{
      storagePath: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      // Display-only, seeded from PrLineItemAttachment.url when editing an
      // existing PR — never read by the RPC, never used to construct a
      // Storage path.
      url: string | null;
    }>;
  }>;
};

// The set of required dropdown fields isn't known until getPrDropdownFields()
// resolves, so unlike every other schema in this codebase this one is built
// at runtime, not written as a static z.object() literal. Each dropdown gets
// its own z.enum() of that field's real option values (not a generic
// non-empty-string check), so a stale/invalid value is actually rejected.
// The explicit z.ZodType<CreateRequisitionFormValues> return annotation is
// what reconciles the dynamically-built schema with the hand-written form
// type — TS can't infer a precise type from a runtime-constructed schema.
export function buildCreateRequisitionSchema(
  dropdownFields: PrDropdownField[],
): z.ZodType<CreateRequisitionFormValues, CreateRequisitionFormValues> {
  const dropdownShape = Object.fromEntries(
    dropdownFields.map((field) => {
      const values = field.options.map((option) => option.value);
      const fieldSchema =
        values.length > 0
          ? z.enum(values as [string, ...string[]], { error: t.fieldRequired })
          : z.string().min(1, { error: t.fieldRequired });
      return [field.key, fieldSchema];
    }),
  );

  // Only the backend-driven dropdown fields, Priority, and each line item's
  // Description are unconditionally required — Requested By, Required Port,
  // Requisition Number, Remarks, custom "Add more" fields, and Approved
  // Qty/Remarks/Photos are all optional. Required Quantity (qty) is
  // conditionally required below, only when category is Stores/Spares.
  return z
    .object({
      priority: z.enum([PR_PRIORITY.HIGH, PR_PRIORITY.MEDIUM, PR_PRIORITY.LOW], {
        error: t.fieldRequired,
      }),
      dropdowns: z.object(dropdownShape),
      requestedBy: z.string(),
      requiredPort: z.string(),
      requisitionNumber: z.string(),
      requisitionDate: z.string(),
      title: z.string(),
      remarks: z.string(),
      equipmentName: z.string(),
      equipmentType: z.string(),
      equipmentMake: z.string(),
      equipmentSerialNo: z.string(),
      equipmentModel: z.string(),
      equipmentSpecifications: z.string(),
      equipmentOtherDetails: z.string(),
      customFields: z.array(z.object({ label: z.string(), value: z.string() })),
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      lineItems: z.array(
        z.object({
          description: z.string().min(1, { error: t.fieldRequired }),
          qty: z.string(),
          extra: z.record(z.string(), z.string()),
          // Re-validates already-uploaded-object metadata — NOT proof the
          // real bytes match (bytes never transit this server; the bucket's
          // file_size_limit/allowed_mime_types is that proof). Defense in
          // depth against an obviously malformed payload; count is the one
          // limit genuinely enforceable here since it rides in this JSON
          // body rather than in file bytes.
          attachments: z
            .array(
              z.object({
                storagePath: z.string().min(1).startsWith(`${PR_LINE_ITEM_PHOTO_PATH_PREFIX}/`),
                fileName: z.string().min(1),
                contentType: z.enum(ALLOWED_PHOTO_MIME_TYPES),
                sizeBytes: z.number().int().positive().max(MAX_PHOTO_SIZE_BYTES),
                url: z.string().nullable(),
              }),
            )
            .max(MAX_PHOTOS_PER_LINE_ITEM, { error: t.tooManyPhotos }),
        }),
      ),
    })
    .superRefine((data, ctx) => {
      // 'category' is hardcoded here the same way this schema's own
      // dropdownShape keys and the list-view's joins already hardcode
      // 'vessel'/'department'/'category' — not a new precedent.
      const category = data.dropdowns.category;
      const qtyRequired = category === PR_CATEGORY.STORES || category === PR_CATEGORY.SPARES;
      if (qtyRequired) {
        data.lineItems.forEach((item, index) => {
          if (!item.qty.trim()) {
            ctx.addIssue({ code: "custom", path: ["lineItems", index, "qty"], message: t.fieldRequired });
          }
        });
      }

      // Required By is optional, but when set it can't be in the past —
      // frontend-only restriction (the <input>'s own `min` attribute blocks
      // picking a past date in the native picker; this catches a typed or
      // pasted one). No backend check, by design.
      if (data.requestedBy && data.requestedBy < todayDateString()) {
        ctx.addIssue({ code: "custom", path: ["requestedBy"], message: t.pastDateNotAllowed });
      }
    });
}

export const askLabelSchema = z.object({
  label: z.string().min(1, { error: t.labelRequired }),
});

export type AskLabelInput = z.infer<typeof askLabelSchema>;
