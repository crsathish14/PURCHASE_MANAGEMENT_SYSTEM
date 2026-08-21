"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Input, Label, PasswordInput, PasswordStrengthMeter } from "@/components/atoms";
import en from "@/locales/en.json";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth";
import { toast } from "@/store/toast-store";

const t = en.changePassword;

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: { email },
  });

  const [watchedEmail, currentPassword, newPassword, confirmNewPassword] = watch([
    "email",
    "currentPassword",
    "newPassword",
    "confirmNewPassword",
  ]);
  const requiredFieldsFilled = Boolean(
    watchedEmail && currentPassword && newPassword && confirmNewPassword,
  );
  const hasErrors = Object.keys(errors).length > 0;

  async function onSubmit(data: ChangePasswordInput) {
    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.errors.networkError);
        return;
      }

      router.push("/en/dashboard");
    } catch {
      toast.error(t.errors.networkError);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-4">
        <Label htmlFor="cp-email" error={!!errors.email}>
          {t.email}
        </Label>
        <Input id="cp-email" type="email" error={errors.email?.message} {...register("email")} />
      </div>

      <div className="mb-4">
        <Label htmlFor="cp-current-password" error={!!errors.currentPassword}>
          {t.currentPassword}
        </Label>
        <PasswordInput
          id="cp-current-password"
          placeholder={t.currentPasswordPlaceholder}
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
      </div>

      <div className="mb-4">
        <Label htmlFor="cp-new-password" error={!!errors.newPassword}>
          {t.newPassword}
        </Label>
        <PasswordInput
          id="cp-new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <PasswordStrengthMeter password={newPassword ?? ""} />
      </div>

      <div className="mb-1">
        <Label htmlFor="cp-confirm-password" error={!!errors.confirmNewPassword}>
          {t.confirmPassword}
        </Label>
        <PasswordInput
          id="cp-confirm-password"
          error={errors.confirmNewPassword?.message}
          {...register("confirmNewPassword")}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={!requiredFieldsFilled || hasErrors}
        className="mt-4.5 w-full"
      >
        {isSubmitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
