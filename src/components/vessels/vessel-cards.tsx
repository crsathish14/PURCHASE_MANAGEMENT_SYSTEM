import { Pencil } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vessel } from "@/lib/data/vessels";

const t = en.staff.vessels;

export function VesselCards({
  vessels,
  onEdit,
}: {
  vessels: Vessel[];
  onEdit: (vessel: Vessel) => void;
}) {
  if (vessels.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-paper px-5 py-10 text-center text-sm text-slate-lt shadow-(--shadow-e1)">
        {t.empty}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {vessels.map((vessel) => (
        <article
          key={vessel.id}
          className="rounded-xl border border-line bg-paper p-5 shadow-(--shadow-e1)"
        >
          <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div className="min-w-0">
              <h2 className="break-words font-display text-lg font-semibold text-ink">
                {vessel.name}
              </h2>
              <p className="mt-1.5 text-xs text-slate">
                <span className="font-semibold">{t.imoNo}:</span> {vessel.imoNo}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${t.editDetails}: ${vessel.name}`}
              onClick={() => onEdit(vessel)}
            >
              <Pencil size={14} aria-hidden="true" />
              {t.editDetails}
            </Button>
          </header>

          <dl className="mt-4 space-y-4">
            <div>
              <dt className="font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
                {t.masterOwners}
              </dt>
              <dd className="mt-1 break-words text-[13px] whitespace-pre-wrap text-ink">
                {vessel.masterOwners || t.emptyValue}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
                {t.companyName}
              </dt>
              <dd className="mt-1 break-words text-[13px] whitespace-pre-wrap text-ink">
                {vessel.companyName || t.emptyValue}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
                {t.address}
              </dt>
              <dd className="mt-1 break-words text-[13px] whitespace-pre-wrap text-ink">
                {vessel.address || t.emptyValue}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
