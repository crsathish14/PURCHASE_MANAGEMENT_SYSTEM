import { z } from "zod";

import en from "@/locales/en.json";

const addVesselErrors = en.staff.vessels.addErrors;

// Vessel code is the first segment of every Purchase Order number, so it is
// normalised to uppercase and restricted to what the DB check constraint allows.
const vesselCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, { error: addVesselErrors.vesselCodeRequired })
  .regex(/^[A-Z0-9]{2,5}$/, { error: addVesselErrors.vesselCodeInvalid });

export const addVesselSchema = z.object({
  name: z.string().min(1, { error: addVesselErrors.nameRequired }),
  imoNo: z.string().min(1, { error: addVesselErrors.imoNoRequired }),
  vesselCode: vesselCodeSchema,
  masterOwners: z.string(),
  companyName: z.string(),
  address: z.string(),
});

export type AddVesselInput = z.infer<typeof addVesselSchema>;

// Address is intentionally not trimmed or normalized: line breaks and spacing
// entered in the textarea are stored and returned as-is.
export const updateVesselDetailsSchema = z.object({
  vesselCode: vesselCodeSchema,
  masterOwners: z.string(),
  companyName: z.string(),
  address: z.string(),
});

export type UpdateVesselDetailsInput = z.infer<typeof updateVesselDetailsSchema>;
