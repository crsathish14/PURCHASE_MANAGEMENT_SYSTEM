import { z } from "zod";

import en from "@/locales/en.json";

const addVesselErrors = en.staff.vessels.addErrors;

export const addVesselSchema = z.object({
  name: z.string().min(1, { error: addVesselErrors.nameRequired }),
  imoNo: z.string().min(1, { error: addVesselErrors.imoNoRequired }),
  masterOwners: z.string(),
  companyName: z.string(),
  address: z.string(),
});

export type AddVesselInput = z.infer<typeof addVesselSchema>;

// Address is intentionally not trimmed or normalized: line breaks and spacing
// entered in the textarea are stored and returned as-is.
export const updateVesselDetailsSchema = z.object({
  masterOwners: z.string(),
  companyName: z.string(),
  address: z.string(),
});

export type UpdateVesselDetailsInput = z.infer<typeof updateVesselDetailsSchema>;
