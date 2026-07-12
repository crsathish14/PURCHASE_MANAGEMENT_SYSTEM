"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Checkbox, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/store/toast-store";

import { EyeIcon } from "../icons";

const t = en.auth.login;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const [email, password] = watch(["email", "password"]);
  const requiredFieldsFilled = Boolean(email && password);
  const hasErrors = Object.keys(errors).length > 0;

  async function onSubmit(data: LoginInput) {
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", signInData.user.id)
        .single();

      if (profileError || !profile || profile.status !== "active") {
        await supabase.auth.signOut();
        toast.error(
          profile?.status === "disabled" ? t.errors.accountDisabled : t.errors.accountPending,
        );
        return;
      }

      router.push("/en/dashboard");
    } catch {
      toast.error(t.errors.networkError);
    }
  }

  return (
    <>
      <h2 className="font-display text-[23px] font-semibold text-ink">{t.title}</h2>
      <div className="mt-3.5 mb-6 h-px bg-line" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4">
          <Label htmlFor="login-email" error={!!errors.email}>
            {t.email}
          </Label>
          <Input
            id="login-email"
            type="email"
            placeholder={t.emailPlaceholder}
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="login-password" error={!!errors.password}>
            {t.password}
          </Label>
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder={t.passwordPlaceholder}
            error={errors.password?.message}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex items-center gap-1 text-[11.5px] font-bold text-slate-lt hover:text-harbor"
              >
                <EyeIcon className="h-3.25 w-3.25" />
                {showPassword ? t.hidePassword : t.showPassword}
              </button>
            }
            {...register("password")}
          />
        </div>

        <div className="mb-5 flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 text-slate">
            <Checkbox {...register("rememberMe")} />
            {t.rememberMe}
          </label>
          <Link href="#" className="font-bold text-harbor hover:underline">
            {t.forgot}
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={!requiredFieldsFilled || hasErrors}
          className="w-full"
        >
          {isSubmitting ? t.submitting : t.submit}
        </Button>
      </form>

      <div className="mt-5.5 border-t border-line pt-5 text-center text-[13px] text-slate">
        {t.switchPrompt}{" "}
        <Link href="/en/request-access" className="font-bold text-harbor hover:underline">
          {t.switchAction}
        </Link>
      </div>
    </>
  );
}
