import { z } from "zod";

import en from "@/locales/en.json";

const t = en.staff.vendors.addErrors;

export const vendorFormFieldsSchema = z.object({
  name: z.string().trim().min(1, { error: t.nameRequired }).max(200, { error: t.nameTooLong }),
  pic: z.string().trim().max(200, { error: t.picTooLong }),
  address: z.string().trim().max(1000, { error: t.addressTooLong }),
  gst: z.string().trim().max(100, { error: t.gstTooLong }),
});

const cleanList = z.array(z.string().trim()).transform((values) => values.filter(Boolean));

export const addVendorSchema = vendorFormFieldsSchema.extend({
  mail: cleanList.pipe(z.array(z.email({ error: t.emailInvalid }))),
  contact: cleanList.pipe(z.array(z.string().max(50, { error: t.contactTooLong }))),
});

export type VendorFormFields = z.infer<typeof vendorFormFieldsSchema>;
export type AddVendorInput = z.infer<typeof addVendorSchema>;
