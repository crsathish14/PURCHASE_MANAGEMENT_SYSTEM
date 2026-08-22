import { z } from "zod";

import en from "@/locales/en.json";
import { PR_PRIORITY } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";

const t = en.staff.poRequests.errors;

export type CreateRequisitionFormValues = {
  priority: string;
  dropdowns: Record<string, string>;
  requestedBy: string;
  requiredPort: string;
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

  // Only the backend-driven dropdown fields and Priority are required —
  // Requested By, Required Port, Remarks, custom "Add more" fields, and line
  // items are all optional.
  return z.object({
    priority: z.enum([PR_PRIORITY.HIGH, PR_PRIORITY.MEDIUM, PR_PRIORITY.LOW], {
      error: t.fieldRequired,
    }),
    dropdowns: z.object(dropdownShape),
    requestedBy: z.string(),
    requiredPort: z.string(),
    remarks: z.string(),
    customFields: z.array(z.object({ label: z.string(), value: z.string() })),
    columns: z.array(z.object({ key: z.string(), label: z.string() })),
    lineItems: z.array(
      z.object({
        description: z.string(),
        qty: z.string(),
        extra: z.record(z.string(), z.string()),
      }),
    ),
  });
}

export const askLabelSchema = z.object({
  label: z.string().min(1, { error: t.labelRequired }),
});

export type AskLabelInput = z.infer<typeof askLabelSchema>;
