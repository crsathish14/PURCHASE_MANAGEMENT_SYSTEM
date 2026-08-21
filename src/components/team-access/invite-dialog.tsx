"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  PasswordInput,
  PasswordStrengthMeter,
  Select,
} from "@/components/atoms";
import en from "@/locales/en.json";
import { USER_ROLE } from "@/lib/constants/profile";
import { inviteSchema, type InviteInput } from "@/lib/validation/auth";
import { toast } from "@/store/toast-store";
import type { TeamMember } from "@/lib/data/team";

const t = en.staff.teamAccess;

export function InviteDialog({
  setMembers,
}: {
  setMembers: Dispatch<SetStateAction<TeamMember[]>>;
}) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    mode: "onBlur",
    defaultValues: { role: USER_ROLE.OFFICER, requirePasswordReset: true },
  });

  const [fullName, email, password, role] = watch(["fullName", "email", "password", "role"]);
  const requiredFieldsFilled = Boolean(fullName && email && password && role);
  const hasErrors = Object.keys(errors).length > 0;

  function close() {
    setOpen(false);
    reset({ role: USER_ROLE.OFFICER, requirePasswordReset: true });
  }

  async function onSubmit(data: InviteInput) {
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.inviteError);
        return;
      }

      setMembers((prev) => [...prev, payload.data]);
      toast.success(t.inviteSuccess);
      close();
    } catch {
      toast.error(t.inviteError);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={15} strokeWidth={2} aria-hidden="true" />
        {t.invite}
      </Button>

      <Dialog open={open} onClose={close} title={t.inviteFormTitle}>
        <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.inviteFormDescription}</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <Label htmlFor="invite-full-name" error={!!errors.fullName}>
              {t.fullName}
            </Label>
            <Input
              id="invite-full-name"
              type="text"
              placeholder={t.fullNamePlaceholder}
              error={errors.fullName?.message}
              {...register("fullName")}
            />
          </div>

          <div className="mb-4">
            <Label htmlFor="invite-email" error={!!errors.email}>
              {t.email}
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t.emailPlaceholder}
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div className="mb-4">
            <Label htmlFor="invite-password" error={!!errors.password}>
              {t.password}
            </Label>
            <PasswordInput
              id="invite-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <PasswordStrengthMeter password={password ?? ""} />
          </div>

          <div className="mb-4">
            <Label htmlFor="invite-role">{t.role}</Label>
            <Select id="invite-role" {...register("role")}>
              <option value={USER_ROLE.OFFICER}>{en.staff.roleLabels.officer}</option>
              <option value={USER_ROLE.ADMIN}>{en.staff.roleLabels.admin}</option>
            </Select>
          </div>

          <label className="mb-5 flex items-center gap-2 text-[13px] text-slate">
            <Checkbox {...register("requirePasswordReset")} />
            {t.requirePasswordReset}
          </label>

          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={close}>
              {t.inviteCancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!requiredFieldsFilled || hasErrors}
            >
              {isSubmitting ? t.inviteSubmitting : t.inviteSubmit}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
