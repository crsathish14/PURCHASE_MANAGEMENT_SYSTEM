import { z } from "zod";

import en from "@/locales/en.json";

const addVesselErrors = en.staff.vessels.addErrors;

export const addVesselSchema = z.object({
  name: z.string().min(1, { error: addVesselErrors.nameRequired }),
  imoNo: z.string().min(1, { error: addVesselErrors.imoNoRequired }),
});

export type AddVesselInput = z.infer<typeof addVesselSchema>;
