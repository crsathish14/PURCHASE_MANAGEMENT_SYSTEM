import { z } from "zod";

import en from "@/locales/en.json";

const loginErrors = en.auth.login.errors;

export const loginSchema = z.object({
  email: z
    .email({ error: loginErrors.emailInvalid })
    .min(1, { error: loginErrors.emailRequired }),
  password: z.string().min(1, { error: loginErrors.passwordRequired }),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

const requestAccessErrors = en.auth.requestAccess.errors;

export const requestAccessSchema = z
  .object({
    fullName: z.string().min(1, { error: requestAccessErrors.fullNameRequired }),
    workEmail: z
      .email({ error: requestAccessErrors.emailInvalid })
      .min(1, { error: requestAccessErrors.emailRequired }),
    role: z.string().min(1, { error: requestAccessErrors.roleRequired }),
    vessel: z.string().min(1, { error: requestAccessErrors.vesselRequired }),
    password: z.string().min(8, { error: requestAccessErrors.passwordMin }),
    confirmPassword: z.string().min(1, { error: requestAccessErrors.confirmPasswordRequired }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: requestAccessErrors.passwordMismatch,
      });
    }
  });

export type RequestAccessInput = z.infer<typeof requestAccessSchema>;
