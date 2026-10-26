"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Dialog, Input, Label, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vessel } from "@/lib/data/vessels";
import { addVesselSchema, type AddVesselInput } from "@/lib/validation/vessel";
import { toast } from "@/store/toast-store";

const t = en.staff.vessels;

export function VesselDialog({
  open,
  vessel,
  onClose,
  setVessels,
}: {
  open: boolean;
  vessel: Vessel | null;
  onClose: () => void;
  setVessels: Dispatch<SetStateAction<Vessel[]>>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddVesselInput>({
    resolver: zodResolver(addVesselSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      imoNo: "",
      masterOwners: "",
      companyName: "",
      address: "",
    },
  });

  const [name, imoNo] = watch(["name", "imoNo"]);
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (!open) return;

    reset({
      name: vessel?.name ?? "",
      imoNo: vessel?.imoNo ?? "",
      masterOwners: vessel?.masterOwners ?? "",
      companyName: vessel?.companyName ?? "",
      address: vessel?.address ?? "",
    });
  }, [open, vessel, reset]);

  function close() {
    onClose();
    reset({ name: "", imoNo: "", masterOwners: "", companyName: "", address: "" });
  }

  async function onSubmit(data: AddVesselInput) {
    const isEditing = !!vessel;

    try {
      const response = await fetch(isEditing ? `/api/vessels/${vessel.id}` : "/api/vessels", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? {
                masterOwners: data.masterOwners,
                companyName: data.companyName,
                address: data.address,
              }
            : data,
        ),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? (isEditing ? t.updateError : t.addError));
        return;
      }

      setVessels((current) => {
        const next = isEditing
          ? current.map((item) => (item.id === payload.data.id ? payload.data : item))
          : [...current, payload.data];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success(isEditing ? t.updateSuccess : t.addSuccess);
      close();
    } catch {
      toast.error(vessel ? t.updateError : t.addError);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={vessel ? t.editFormTitle : t.addFormTitle}
      size="lg"
    >
      <p className="mb-5 text-[13px] leading-relaxed text-slate">
        {vessel ? t.editFormDescription : t.addFormDescription}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {vessel ? (
          <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg bg-mist/50 p-3 sm:grid-cols-2">
            <div>
              <Label>{t.name}</Label>
              <p className="text-[13px] font-semibold text-ink">{vessel.name}</p>
            </div>
            <div>
              <Label>{t.imoNo}</Label>
              <p className="text-[13px] text-ink">{vessel.imoNo}</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
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

            <div>
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
          </div>
        )}

        <div className="mb-4">
          <Label htmlFor="vessel-master-owners">{t.masterOwners}</Label>
          <Input
            id="vessel-master-owners"
            type="text"
            placeholder={t.masterOwnersPlaceholder}
            {...register("masterOwners")}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="vessel-company-name">{t.companyName}</Label>
          <Input
            id="vessel-company-name"
            type="text"
            placeholder={t.companyNamePlaceholder}
            {...register("companyName")}
          />
        </div>

        <div className="mb-5">
          <Label htmlFor="vessel-address">{t.address}</Label>
          <Textarea
            id="vessel-address"
            rows={4}
            placeholder={t.addressPlaceholder}
            {...register("address")}
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
            disabled={(!vessel && (!name || !imoNo)) || hasErrors}
          >
            {isSubmitting
              ? vessel
                ? t.updateSubmitting
                : t.addSubmitting
              : vessel
                ? t.updateSubmit
                : t.addSubmit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
