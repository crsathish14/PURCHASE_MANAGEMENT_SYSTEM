import { z } from "zod";

import en from "@/locales/en.json";
import { PR_CATEGORY, PR_PRIORITY } from "@/lib/constants/purchase-requisition";
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
  remarks: string;
  customFields: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string }>;
  lineItems: Array<{ description: string; qty: string; extra: Record<string, string> }>;
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
      remarks: z.string(),
      customFields: z.array(z.object({ label: z.string(), value: z.string() })),
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      lineItems: z.array(
        z.object({
          description: z.string().min(1, { error: t.fieldRequired }),
          qty: z.string(),
          extra: z.record(z.string(), z.string()),
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
