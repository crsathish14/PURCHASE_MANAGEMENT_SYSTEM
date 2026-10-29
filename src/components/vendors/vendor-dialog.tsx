"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";

import { Button, Dialog, Input, Label, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vendor } from "@/lib/data/vendors";
import { vendorFormFieldsSchema, type VendorFormFields } from "@/lib/validation/vendor";
import { toast } from "@/store/toast-store";

const t = en.staff.vendors;

export function VendorDialog({
  open,
  vendor,
  onClose,
  setVendors,
}: {
  open: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  setVendors: Dispatch<SetStateAction<Vendor[]>>;
}) {
  const [mail, setMail] = useState<string[]>([""]);
  const [contact, setContact] = useState<string[]>([""]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormFields>({
    resolver: zodResolver(vendorFormFieldsSchema),
    mode: "onBlur",
    defaultValues: { name: "", pic: "", address: "", gst: "" },
  });

  const name = watch("name");

  useEffect(() => {
    if (!open) return;

    reset({
      name: vendor?.name ?? "",
      pic: vendor?.pic ?? "",
      address: vendor?.address ?? "",
      gst: vendor?.gst ?? "",
    });
    setMail(vendor?.mail.length ? [...vendor.mail] : [""]);
    setContact(vendor?.contact.length ? [...vendor.contact] : [""]);
  }, [open, vendor, reset]);

  async function onSubmit(data: VendorFormFields) {
    const payload = {
      ...data,
      mail: mail.map((value) => value.trim()).filter(Boolean),
      contact: contact.map((value) => value.trim()).filter(Boolean),
    };
    const isEditing = !!vendor;

    try {
      const response = await fetch(isEditing ? `/api/vendors/${vendor.id}` : "/api/vendors", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result?.error?.message ?? (isEditing ? t.updateError : t.addError));
        return;
      }

      setVendors((prev) => {
        const next = isEditing
          ? prev.map((current) => (current.id === result.data.id ? result.data : current))
          : [...prev, result.data];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success(isEditing ? t.updateSuccess : t.addSuccess);
      onClose();
    } catch {
      toast.error(isEditing ? t.updateError : t.addError);
    }
  }

  return (
      <Dialog
        open={open}
        onClose={onClose}
        title={vendor ? t.editFormTitle : t.addFormTitle}
        size="lg"
      >
        <p className="mb-5 text-[13px] leading-relaxed text-slate">
          {vendor ? t.editFormDescription : t.addFormDescription}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vendor-name" error={!!errors.name} required>
                {t.name}
              </Label>
              <Input
                id="vendor-name"
                type="text"
                placeholder={t.namePlaceholder}
                error={errors.name?.message}
                {...register("name")}
              />
            </div>

            <div>
              <Label htmlFor="vendor-pic" error={!!errors.pic}>
                {t.pic}
              </Label>
              <Input
                id="vendor-pic"
                type="text"
                placeholder={t.picPlaceholder}
                error={errors.pic?.message}
                {...register("pic")}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="vendor-address" error={!!errors.address}>
                {t.address}
              </Label>
              <Textarea
                id="vendor-address"
                rows={3}
                placeholder={t.addressPlaceholder}
                error={errors.address?.message}
                {...register("address")}
              />
            </div>

            <div>
              <Label htmlFor="vendor-mail-0">{t.mail}</Label>
              <div className="space-y-2">
                {mail.map((value, index) => (
                  <div key={`mail-${index}`} className="flex items-center gap-2">
                    <Input
                      id={`vendor-mail-${index}`}
                      type="email"
                      value={value}
                      onChange={(event) =>
                        setMail((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={t.mailPlaceholder}
                      aria-label={`${t.mail} ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="icon"
                      aria-label={`${t.remove} ${t.mail} ${index + 1}`}
                      onClick={() => setMail((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => setMail((current) => [...current, ""])}
              >
                <Plus size={14} aria-hidden="true" />
                {t.addMail}
              </Button>
            </div>

            <div>
              <Label htmlFor="vendor-contact-0">{t.contact}</Label>
              <div className="space-y-2">
                {contact.map((value, index) => (
                  <div key={`contact-${index}`} className="flex items-center gap-2">
                    <Input
                      id={`vendor-contact-${index}`}
                      type="tel"
                      value={value}
                      onChange={(event) =>
                        setContact((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={t.contactPlaceholder}
                      aria-label={`${t.contact} ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="icon"
                      aria-label={`${t.remove} ${t.contact} ${index + 1}`}
                      onClick={() => setContact((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => setContact((current) => [...current, ""])}
              >
                <Plus size={14} aria-hidden="true" />
                {t.addContact}
              </Button>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="vendor-gst" error={!!errors.gst}>
                {t.gst}
              </Label>
              <Input
                id="vendor-gst"
                type="text"
                placeholder={t.gstPlaceholder}
                error={errors.gst?.message}
                {...register("gst")}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t.addCancel}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!name?.trim()}>
              {isSubmitting
                ? vendor
                  ? t.updateSubmitting
                  : t.addSubmitting
                : vendor
                  ? t.updateSubmit
                  : t.addSubmit}
            </Button>
          </div>
        </form>
      </Dialog>
  );
}
