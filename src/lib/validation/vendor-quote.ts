import { z } from "zod";

import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";

const t = en.vendorQuote.storesForm.errors;

// Stores and Spares require a price for every line item. The remaining
// optional item fields may still be left blank. unitPrice stays a plain
// string (the raw input value) rather than z.number(), and the RPC re-derives
// every total from it and the requisition's own Approved Qty.
// A vendor-uploaded photo already uploaded to Storage via
// /api/quote/[token]/photos/sign + uploadToSignedUrl — this object is just
// the metadata the final submit persists, never raw file bytes.
export const vendorQuoteItemPhotoSchema = z.object({
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const vendorQuoteItemSchema = z.object({
  lineItemId: z.string().min(1),
  offeredDescription: z.string().min(1, { error: t.offeredDescriptionRequired }),
  offeredImpaCode: z.string(),
  // Any number of decimal places — no rounding/truncation to 2dp, per the
  // confirmed spec (some vendors quote in fractional-cent unit prices).
  unitPrice: z
    .string()
    .min(1, { error: t.unitPriceRequired })
    .regex(/^\d+(\.\d+)?$/, { error: t.unitPriceInvalid }),
  // Whole days only — matches the new "(In Days)" column header.
  deliveryLeadTime: z.string().refine((value) => value === "" || /^\d+$/.test(value), {
    error: t.deliveryLeadTimeInvalid,
  }),
  remarks: z.string(),
  // Not RHF-registered (see stores-quote-form.tsx / vendor-item-photos-field.tsx) — tracked in
  // local component state and merged into the payload at submit time, so it's always present
  // (possibly empty) by the time this schema validates the full request body.
  photos: z.array(vendorQuoteItemPhotoSchema),
});

// Shared by the Stores vendor form (client-side resolver) and the submit
// route (server-side re-validation) — same pattern as
// buildCreateRequisitionSchema/issueRfqLinkSchema being wired to both a form
// and its API route. Only vendorName plus the four Quotation Summary fields
// are required, per the confirmed spec: Quotation No./Ref. No. and every
// other Vendor Details field stay optional.
export const submitStoresVendorQuoteSchema = z.object({
  quotationNo: z.string(),
  refNo: z.string(),
  vendorName: z.string().min(1, { error: t.vendorNameRequired }),
  vendorContactPerson: z.string(),
  vendorContactNo: z.string(),
  vendorEmail: z.union([z.literal(""), z.email({ error: t.vendorEmailInvalid })]),
  vendorOtherDetails: z.string(),
  quotationValidity: z.string().min(1, { error: t.quotationValidityRequired }),
  paymentTerms: z.string().min(1, { error: t.paymentTermsRequired }),
  deliveryTerms: z.string().min(1, { error: t.deliveryTermsRequired }),
  remarksNotes: z.string(),
  items: z.array(vendorQuoteItemSchema),
});

export type SubmitStoresVendorQuoteInput = z.infer<typeof submitStoresVendorQuoteSchema>;

const tSpares = en.vendorQuote.sparesForm.errors;

// Mirrors vendorQuoteItemSchema exactly, swapping Stores' offeredImpaCode for
// Spares' own offeredPartNo/itemType — itemType is free text per the
// confirmed spec (not a constrained dropdown), so it's an unconstrained
// z.string() like every other vendor-entered text field here.
export const sparesVendorQuoteItemSchema = z.object({
  lineItemId: z.string().min(1),
  offeredDescription: z.string().min(1, { error: tSpares.offeredDescriptionRequired }),
  offeredPartNo: z.string(),
  itemType: z.string(),
  unitPrice: z
    .string()
    .min(1, { error: tSpares.unitPriceRequired })
    .regex(/^\d+(\.\d+)?$/, { error: tSpares.unitPriceInvalid }),
  deliveryLeadTime: z.string().refine((value) => value === "" || /^\d+$/.test(value), {
    error: tSpares.deliveryLeadTimeInvalid,
  }),
  remarks: z.string(),
  photos: z.array(vendorQuoteItemPhotoSchema),
});

export const submitSparesVendorQuoteSchema = z.object({
  quotationNo: z.string(),
  refNo: z.string(),
  vendorName: z.string().min(1, { error: tSpares.vendorNameRequired }),
  vendorContactPerson: z.string(),
  vendorContactNo: z.string(),
  vendorEmail: z.union([z.literal(""), z.email({ error: tSpares.vendorEmailInvalid })]),
  vendorOtherDetails: z.string(),
  quotationValidity: z.string().min(1, { error: tSpares.quotationValidityRequired }),
  paymentTerms: z.string().min(1, { error: tSpares.paymentTermsRequired }),
  deliveryTerms: z.string().min(1, { error: tSpares.deliveryTermsRequired }),
  remarksNotes: z.string(),
  items: z.array(sparesVendorQuoteItemSchema),
});

export type SubmitSparesVendorQuoteInput = z.infer<typeof submitSparesVendorQuoteSchema>;

const tService = en.vendorQuote.serviceForm.errors;

// Service has no Qty concept and no requested/offered description split (its
// item table has exactly one, pre-filled, description column — see
// plans/development.md §17) — so unlike Stores/Spares, there's no
// offeredDescription and no deliveryLeadTime field here at all.
export const serviceVendorQuoteItemSchema = z.object({
  lineItemId: z.string().min(1),
  // Whole days only, same shape as Stores/Spares' own deliveryLeadTime — this
  // is what rfq-links.ts's max-days computation for the vendor modal reads.
  estimatedDuration: z.string().refine((value) => value === "" || /^\d+$/.test(value), {
    error: tService.estimatedDurationInvalid,
  }),
  sparesConsumablesIncluded: z.string(),
  // Doubles as the Lump Sum value; Total Price is computed from this
  // directly (no Qty to multiply by) rather than being its own field.
  unitPrice: z.string().refine((value) => value === "" || /^\d+(\.\d+)?$/.test(value), {
    error: tService.unitPriceInvalid,
  }),
  remarks: z.string(),
  photos: z.array(vendorQuoteItemPhotoSchema),
});

export const submitServiceVendorQuoteSchema = z.object({
  quotationNo: z.string(),
  refNo: z.string(),
  vendorName: z.string().min(1, { error: tService.vendorNameRequired }),
  vendorContactPerson: z.string(),
  vendorContactNo: z.string(),
  vendorEmail: z.union([z.literal(""), z.email({ error: tService.vendorEmailInvalid })]),
  vendorOtherDetails: z.string(),
  quotationValidity: z.string().min(1, { error: tService.quotationValidityRequired }),
  paymentTerms: z.string().min(1, { error: tService.paymentTermsRequired }),
  deliveryTerms: z.string().min(1, { error: tService.deliveryTermsRequired }),
  remarksNotes: z.string(),
  items: z.array(serviceVendorQuoteItemSchema),
});

export type SubmitServiceVendorQuoteInput = z.infer<typeof submitServiceVendorQuoteSchema>;

const tLo = en.vendorQuote.loForm.errors;

// LO item schema mirrors Stores exactly, except there is no offeredImpaCode —
// LO has no IMPA/ISSA Code column at any stage.
export const loVendorQuoteItemSchema = z.object({
  lineItemId: z.string().min(1),
  offeredDescription: z.string().min(1, { error: tLo.offeredDescriptionRequired }),
  unitPrice: z
    .string()
    .min(1, { error: tLo.unitPriceRequired })
    .regex(/^\d+(\.\d+)?$/, { error: tLo.unitPriceInvalid }),
  deliveryLeadTime: z.string().refine((value) => value === "" || /^\d+$/.test(value), {
    error: tLo.deliveryLeadTimeInvalid,
  }),
  remarks: z.string(),
  photos: z.array(vendorQuoteItemPhotoSchema),
});

export const submitLoVendorQuoteSchema = z.object({
  quotationNo: z.string(),
  refNo: z.string(),
  vendorName: z.string().min(1, { error: tLo.vendorNameRequired }),
  vendorContactPerson: z.string(),
  vendorContactNo: z.string(),
  vendorEmail: z.union([z.literal(""), z.email({ error: tLo.vendorEmailInvalid })]),
  vendorOtherDetails: z.string(),
  quotationValidity: z.string().min(1, { error: tLo.quotationValidityRequired }),
  paymentTerms: z.string().min(1, { error: tLo.paymentTermsRequired }),
  deliveryTerms: z.string().min(1, { error: tLo.deliveryTermsRequired }),
  remarksNotes: z.string(),
  items: z.array(loVendorQuoteItemSchema),
});

export type SubmitLoVendorQuoteInput = z.infer<typeof submitLoVendorQuoteSchema>;

// Blank values for each category's vendor-editable line item fields. The form
// only ever holds one page of line items, so a row the vendor never opened
// exists only on the server — the submit route fills it in from these before
// validating, and each form seeds its page rows from the same constants.
export const BLANK_STORES_ITEM_FIELDS = {
  offeredDescription: "",
  offeredImpaCode: "",
  unitPrice: "",
  deliveryLeadTime: "",
  remarks: "",
};

export const BLANK_SPARES_ITEM_FIELDS = {
  offeredDescription: "",
  offeredPartNo: "",
  itemType: "",
  unitPrice: "",
  deliveryLeadTime: "",
  remarks: "",
};

export const BLANK_SERVICE_ITEM_FIELDS = {
  estimatedDuration: "",
  sparesConsumablesIncluded: "",
  unitPrice: "",
  remarks: "",
};

export const BLANK_LO_ITEM_FIELDS = {
  offeredDescription: "",
  unitPrice: "",
  deliveryLeadTime: "",
  remarks: "",
};

// Which submit schema and blank item shape apply to a requisition's category.
// An unrecognized or missing category falls through to Stores, matching the
// submit RPC's own fallback.
export function getVendorQuoteSchemaConfig(category: string | null) {
  switch (category) {
    case PR_CATEGORY.SPARES:
      return { schema: submitSparesVendorQuoteSchema, blankItemFields: BLANK_SPARES_ITEM_FIELDS };
    case PR_CATEGORY.SERVICE:
      return { schema: submitServiceVendorQuoteSchema, blankItemFields: BLANK_SERVICE_ITEM_FIELDS };
    case PR_CATEGORY.LO:
      return { schema: submitLoVendorQuoteSchema, blankItemFields: BLANK_LO_ITEM_FIELDS };
    default:
      return { schema: submitStoresVendorQuoteSchema, blankItemFields: BLANK_STORES_ITEM_FIELDS };
  }
}
