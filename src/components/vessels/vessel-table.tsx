import en from "@/locales/en.json";
import type { Vessel } from "@/lib/data/vessels";

const t = en.staff.vessels;

// No row actions — list + add only, by design (existing requisitions already
// reference old vessel data, so edit/delete aren't needed here).
export function VesselTable({ vessels }: { vessels: Vessel[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border-b border-line px-5 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
            {t.columns.name}
          </th>
          <th className="border-b border-line px-5 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
            {t.columns.imoNo}
          </th>
        </tr>
      </thead>
      <tbody>
        {vessels.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-5 py-8 text-center text-sm text-slate-lt">
              {t.empty}
            </td>
          </tr>
        ) : (
          vessels.map((vessel) => (
            <tr key={vessel.id} className="group">
              <td className="border-b border-line px-5 py-3 text-[13.3px] font-bold text-ink group-hover:bg-mist/40">
                {vessel.name}
              </td>
              <td className="border-b border-line px-5 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                {vessel.imoNo}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
