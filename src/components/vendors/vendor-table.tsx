"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Trash2 } from "lucide-react";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vendor } from "@/lib/data/vendors";
import { toast } from "@/store/toast-store";

const t = en.staff.vendors;

export function VendorTable({
  vendors,
  setVendors,
  onEdit,
}: {
  vendors: Vendor[];
  setVendors: Dispatch<SetStateAction<Vendor[]>>;
  onEdit: (vendor: Vendor) => void;
}) {
  const [removeTarget, setRemoveTarget] = useState<Vendor | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeVendor() {
    if (!removeTarget) return;

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/vendors/${removeTarget.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error?.message ?? t.removeError);
        return;
      }

      setVendors((current) => current.filter((vendor) => vendor.id !== removeTarget.id));
      toast.success(t.removeSuccess);
      setRemoveTarget(null);
    } catch {
      toast.error(t.removeError);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {(["name", "pic", "address", "mail", "contact", "gst"] as const).map((column) => (
                <th key={column} className="border-b border-line px-4 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
                  {t.columns[column]}
                </th>
              ))}
              <th className="border-b border-line px-4 py-2.5 text-right font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
                {t.columns.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-lt">
                  {t.empty}
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="group cursor-pointer"
                  onClick={() => onEdit(vendor)}
                >
                  <td className="max-w-[220px] border-b border-line px-4 py-3 text-[13.3px] font-bold text-ink group-hover:bg-mist/40">
                    <button
                      type="button"
                      className="text-left hover:text-harbor hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-harbor"
                      aria-label={`${t.editAction}: ${vendor.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(vendor);
                      }}
                    >
                      {vendor.name}
                    </button>
                  </td>
                  <td className="max-w-[150px] border-b border-line px-4 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                    {vendor.pic || t.emptyValue}
                  </td>
                  <td className="max-w-[240px] border-b border-line px-4 py-3 text-[13.3px] whitespace-pre-line text-ink group-hover:bg-mist/40">
                    {vendor.address || t.emptyValue}
                  </td>
                  <td className="max-w-[220px] border-b border-line px-4 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                    {vendor.mail.length
                      ? vendor.mail.map((email, index) => (
                          <div key={`${vendor.id}-mail-${index}`} className="break-all">
                            {email}
                          </div>
                        ))
                      : t.emptyValue}
                  </td>
                  <td className="max-w-[180px] border-b border-line px-4 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                    {vendor.contact.length
                      ? vendor.contact.map((number, index) => (
                          <div key={`${vendor.id}-contact-${index}`} className="whitespace-nowrap">
                            {number}
                          </div>
                        ))
                      : t.emptyValue}
                  </td>
                  <td className="max-w-[160px] border-b border-line px-4 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                    {vendor.gst || t.emptyValue}
                  </td>
                  <td className="border-b border-line px-4 py-3 text-right group-hover:bg-mist/40">
                    <Button
                      variant="icon"
                      aria-label={`${t.remove}: ${vendor.name}`}
                      title={t.remove}
                      onClick={(event) => {
                        event.stopPropagation();
                        setRemoveTarget(vendor);
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!removeTarget}
        onClose={() => (isRemoving ? undefined : setRemoveTarget(null))}
        title={t.removeTitle}
      >
        <p className="mb-5 text-[13px] leading-relaxed text-slate">
          {t.removeDescription.replace("{name}", removeTarget?.name ?? "")}
        </p>
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => setRemoveTarget(null)} disabled={isRemoving}>
            {t.removeCancel}
          </Button>
          <Button type="button" variant="danger" loading={isRemoving} onClick={removeVendor}>
            {isRemoving ? t.removeSubmitting : t.removeConfirm}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
