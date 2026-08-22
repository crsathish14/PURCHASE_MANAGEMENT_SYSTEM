import { z } from "zod";

import { USER_ROLE } from "@/lib/constants/profile";
import en from "@/locales/en.json";

const loginErrors = en.auth.login.errors;

export const loginSchema = z.object({
  email: z
    .email({ error: loginErrors.emailInvalid })
    .min(1, { error: loginErrors.emailRequired }),
  password: z.string().min(1, { error: loginErrors.passwordRequired }),
});

export type LoginInput = z.infer<typeof loginSchema>;

const requestAccessErrors = en.auth.requestAccess.errors;

export const requestAccessSchema = z
  .object({
    fullName: z.string().min(1, { error: requestAccessErrors.fullNameRequired }),
    workEmail: z
      .email({ error: requestAccessErrors.emailInvalid })
      .min(1, { error: requestAccessErrors.emailRequired }),
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

const inviteErrors = en.staff.teamAccess.inviteErrors;

export const inviteSchema = z.object({
  fullName: z.string().min(1, { error: inviteErrors.fullNameRequired }),
  email: z.email({ error: inviteErrors.emailInvalid }).min(1, { error: inviteErrors.emailRequired }),
  password: z.string().min(8, { error: inviteErrors.passwordMin }),
  role: z.enum([USER_ROLE.ADMIN, USER_ROLE.OFFICER]),
  requirePasswordReset: z.boolean(),
});

export type InviteInput = z.infer<typeof inviteSchema>;

const resetPasswordErrors = en.staff.teamAccess.resetErrors;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, { error: resetPasswordErrors.passwordMin }),
  requirePasswordReset: z.boolean(),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const changePasswordErrors = en.changePassword.errors;

export const changePasswordSchema = z
  .object({
    email: z
      .email({ error: changePasswordErrors.emailInvalid })
      .min(1, { error: changePasswordErrors.emailRequired }),
    currentPassword: z.string().min(1, { error: changePasswordErrors.currentPasswordRequired }),
    newPassword: z.string().min(8, { error: changePasswordErrors.passwordMin }),
    confirmNewPassword: z.string().min(1, { error: changePasswordErrors.confirmPasswordRequired }),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmNewPassword"],
        message: changePasswordErrors.passwordMismatch,
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
