"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";

import { Button, Dialog, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import { addVesselSchema, type AddVesselInput } from "@/lib/validation/vessel";
import { toast } from "@/store/toast-store";
import type { Vessel } from "@/lib/data/vessels";

const t = en.staff.vessels;

export function VesselDialog({
  setVessels,
}: {
  setVessels: Dispatch<SetStateAction<Vessel[]>>;
}) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddVesselInput>({
    resolver: zodResolver(addVesselSchema),
    mode: "onBlur",
    defaultValues: { name: "", imoNo: "" },
  });

  const [name, imoNo] = watch(["name", "imoNo"]);
  const requiredFieldsFilled = Boolean(name && imoNo);
  const hasErrors = Object.keys(errors).length > 0;

  function close() {
    setOpen(false);
    reset({ name: "", imoNo: "" });
  }

  async function onSubmit(data: AddVesselInput) {
    try {
      const response = await fetch("/api/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.addError);
        return;
      }

      setVessels((prev) => [...prev, payload.data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(t.addSuccess);
      close();
    } catch {
      toast.error(t.addError);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={15} strokeWidth={2} aria-hidden="true" />
        {t.addVessel}
      </Button>

      <Dialog open={open} onClose={close} title={t.addFormTitle}>
        <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.addFormDescription}</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <Label htmlFor="vessel-name" error={!!errors.name}>
              {t.name}
            </Label>
            <Input
              id="vessel-name"
              type="text"
              placeholder={t.namePlaceholder}
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="mb-4">
            <Label htmlFor="vessel-imo-no" error={!!errors.imoNo}>
              {t.imoNo}
            </Label>
            <Input
              id="vessel-imo-no"
              type="text"
              placeholder={t.imoNoPlaceholder}
              error={errors.imoNo?.message}
              {...register("imoNo")}
            />
          </div>

          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={close}>
              {t.addCancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!requiredFieldsFilled || hasErrors}
            >
              {isSubmitting ? t.addSubmitting : t.addSubmit}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
