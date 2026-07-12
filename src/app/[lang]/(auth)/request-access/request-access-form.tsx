"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import { requestAccessSchema, type RequestAccessInput } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/store/toast-store";

import { EyeIcon } from "../icons";

const t = en.auth.requestAccess;

const STRENGTH_LABELS = [t.strength.weak, t.strength.weak, t.strength.fair, t.strength.good, t.strength.strong];

function passwordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function  RequestAccessForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestAccessInput>({
    resolver: zodResolver(requestAccessSchema),
    mode: "onBlur",
  });

  const [fullName, workEmail, password, confirmPassword] = watch([
    "fullName",
    "workEmail",
    "password",
    "confirmPassword",
  ]);
  const strength = passwordStrength(password ?? "");
  const requiredFieldsFilled = Boolean(fullName && workEmail && password && confirmPassword);
  const hasErrors = Object.keys(errors).length > 0;

  async function onSubmit(data: RequestAccessInput) {
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.workEmail,
        password: data.password,
        options: {
          data: { full_name: data.fullName },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/en/login`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Supabase returns a "successful" response with an empty identities
      // array (no error) for an already-registered email when enumeration
      // protection is on, to avoid leaking which emails exist.
      if (signUpData.user && signUpData.user.identities?.length === 0) {
        toast.error(t.errors.emailInUse);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error(t.errors.networkError);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="font-display text-[23px] font-semibold text-ink">{t.successTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">{t.successDescription}</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="font-display text-[23px] font-semibold text-ink">{t.title}</h2>
      <p className="mt-2 mb-6.5 text-[13px] leading-relaxed text-slate">{t.description}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4">
          <Label htmlFor="ra-full-name" error={!!errors.fullName}>
            {t.fullName}
          </Label>
          <Input
            id="ra-full-name"
            type="text"
            placeholder={t.fullNamePlaceholder}
            error={errors.fullName?.message}
            {...register("fullName")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="ra-email" error={!!errors.workEmail}>
            {t.workEmail}
          </Label>
          <Input
            id="ra-email"
            type="email"
            placeholder={t.workEmailPlaceholder}
            error={errors.workEmail?.message}
            {...register("workEmail")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="ra-password" error={!!errors.password}>
            {t.password}
          </Label>
          <Input
            id="ra-password"
            type={showPassword ? "text" : "password"}
            error={errors.password?.message}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex items-center gap-1 text-[11.5px] font-bold text-slate-lt hover:text-harbor"
              >
                <EyeIcon className="h-3.25 w-3.25" />
                {showPassword ? en.auth.login.hidePassword : en.auth.login.showPassword}
              </button>
            }
            {...register("password")}
          />
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i < strength ? "bg-moss" : "bg-line"}`}
              />
            ))}
          </div>
          <div className="mt-1.25 flex justify-between text-[11px] text-slate-lt">
            <span>{t.strengthLabel}</span>
            {strength > 0 ? <b className="font-bold text-moss">{STRENGTH_LABELS[strength]}</b> : null}
          </div>
        </div>

        <div className="mb-1">
          <Label htmlFor="ra-confirm-password" error={!!errors.confirmPassword}>
            {t.confirmPassword}
          </Label>
          <Input
            id="ra-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            error={errors.confirmPassword?.message}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="flex items-center gap-1 text-[11.5px] font-bold text-slate-lt hover:text-harbor"
              >
                <EyeIcon className="h-3.25 w-3.25" />
                {showConfirmPassword ? en.auth.login.hidePassword : en.auth.login.showPassword}
              </button>
            }
            {...register("confirmPassword")}
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
        <div className="mt-3 text-center text-[11.5px] leading-relaxed text-slate-lt">{t.hint}</div>
      </form>

      <div className="mt-5.5 border-t border-line pt-5 text-center text-[13px] text-slate">
        {t.switchPrompt}{" "}
        <Link href="/en/login" className="font-bold text-harbor hover:underline">
          {t.switchAction}
        </Link>
      </div>
    </>
  );
}
