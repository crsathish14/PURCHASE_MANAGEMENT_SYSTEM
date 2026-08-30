import { z } from "zod";

import en from "@/locales/en.json";

const t = en.vendorQuote.storesForm.errors;

// unitPrice/offeredDescription/offeredImpaCode/deliveryLeadTime/remarks are
// all optional — a vendor can leave a line item unpriced (see
// plans/development.md, "no minimum-priced-item requirement"). unitPrice
// stays a plain string (the raw input value) rather than z.number() since an
// empty string is exactly how "not priced" is represented on the wire; the
// backend RPC re-derives/recalculates every total from this and the PR's own
// Approved Qty regardless of what's sent here.
export const vendorQuoteItemSchema = z.object({
  lineItemId: z.string().min(1),
  offeredDescription: z.string(),
  offeredImpaCode: z.string(),
  unitPrice: z.string().refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), {
    error: t.unitPriceInvalid,
  }),
  deliveryLeadTime: z.string(),
  remarks: z.string(),
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
  remarksNotes: z.string().min(1, { error: t.remarksNotesRequired }),
  items: z.array(vendorQuoteItemSchema),
});

export type SubmitStoresVendorQuoteInput = z.infer<typeof submitStoresVendorQuoteSchema>;
