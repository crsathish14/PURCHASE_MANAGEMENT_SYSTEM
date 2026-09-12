import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { PR_CATEGORY, type PrCategory } from "@/lib/constants/purchase-requisition";
import { getPrDropdownFields, getPurchaseRequisitionById } from "@/lib/data/purchase-requisition";
import { getVessels } from "@/lib/data/vessels";
import {
  readServiceTemplateBuffer,
  readSparesTemplateBuffer,
  readStoresTemplateBuffer,
} from "@/lib/purchase-requisition/templates";
import { fillStoresVbaRequisitionTemplate } from "@/lib/purchase-requisition/export-template-vba";
import { fillSparesVbaRequisitionTemplate } from "@/lib/purchase-requisition/export-template-vba-spares";
import { fillServiceVbaRequisitionTemplate } from "@/lib/purchase-requisition/export-template-vba-service";
import type { ExportRequisitionData } from "@/lib/purchase-requisition/export-template-vba-shared";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const TEMPLATE_BUFFER_READER: Record<PrCategory, () => Promise<Buffer>> = {
  [PR_CATEGORY.STORES]: readStoresTemplateBuffer,
  [PR_CATEGORY.SPARES]: readSparesTemplateBuffer,
  [PR_CATEGORY.SERVICE]: readServiceTemplateBuffer,
};

// Exact sheet names each template's own VBA source authors them with — see
// import-template.ts's own dispatcher, which detects a format by this same
// sheet name.
const SHEET_NAME: Record<PrCategory, string> = {
  [PR_CATEGORY.STORES]: "Stores Requisition Form",
  [PR_CATEGORY.SPARES]: "Spares Requisition Form",
  [PR_CATEGORY.SERVICE]: "Service Requisition Form",
};

const FILL_TEMPLATE: Record<PrCategory, (sheet: ExcelJS.Worksheet, data: ExportRequisitionData) => void> = {
  [PR_CATEGORY.STORES]: fillStoresVbaRequisitionTemplate,
  [PR_CATEGORY.SPARES]: fillSparesVbaRequisitionTemplate,
  [PR_CATEGORY.SERVICE]: fillServiceVbaRequisitionTemplate,
};

function isPrCategory(value: string): value is PrCategory {
  return value === PR_CATEGORY.STORES || value === PR_CATEGORY.SPARES || value === PR_CATEGORY.SERVICE;
}

// GET /api/purchase-requisitions/[id]/export — downloads this PR's own data
// filled into a copy of its category's official template. Deliberately a
// plain .xlsx, not .xlsm: the templates carry a real VBA project (Add Line
// Item button, Ctrl+V photo-paste binding) that ExcelJS 4.4.0 cannot
// preserve through a load()/writeBuffer() round trip (it has no code path
// that ever reads or re-emits xl/vbaProject.bin) — loading one of these
// files and saving it back out under the .xlsm name/content-type would risk
// Excel flagging the output as corrupted. What survives the round trip
// (verified against the real template files): fonts/colors/borders, the
// embedded logo image, merged-cell layout, and sheet protection — everything
// but the macros, which a completed record doesn't need anyway (product
// decision). Photos are out of scope for this feature — the template's own
// SUPPORTING PHOTOS table is left exactly as shipped, untouched.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const prDetail = await getPurchaseRequisitionById(id);
    if (!prDetail) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }

    const categoryValue = prDetail.dropdowns.category;
    if (!categoryValue || !isPrCategory(categoryValue)) {
      return NextResponse.json({ error: { message: "This requisition has no recognized category." } }, { status: 400 });
    }
    const category = categoryValue;

    // dropdowns.vessel is only ever the raw option slug — resolving it to a
    // name (and from there, an IMO No.) takes the same two-hop join
    // get_rfq_quote_details_by_token/add_vessel() already establish, done as
    // plain TS calls (same reasoning rfq-quote-comparison.ts already
    // documents for doing this at the app layer instead of embedded SQL).
    const [dropdownFields, vessels] = await Promise.all([getPrDropdownFields(), getVessels()]);
    const vesselField = dropdownFields.find((field) => field.key === "vessel");
    const vesselSlug = prDetail.dropdowns.vessel;
    const vesselLabel = vesselField?.options.find((option) => option.value === vesselSlug)?.label ?? "";
    const vesselImoNo = vessels.find((vessel) => vessel.name === vesselLabel)?.imoNo ?? "";

    const data: ExportRequisitionData = {
      vesselName: vesselLabel,
      vesselImoNo,
      requisitionDate: prDetail.requisitionDate ? new Date(prDetail.requisitionDate) : null,
      requisitionNumber: prDetail.requisitionNumber ?? "",
      requiredPort: prDetail.requiredPort ?? "",
      title: prDetail.title ?? "",
      requisitionedBy: prDetail.requisitionedBy ?? "",
      captainChiefEngineer: prDetail.captainChiefEngineer ?? "",
      equipmentName: prDetail.equipmentName ?? "",
      equipmentType: prDetail.equipmentType ?? "",
      equipmentMake: prDetail.equipmentMake ?? "",
      equipmentSerialNo: prDetail.equipmentSerialNo ?? "",
      equipmentModel: prDetail.equipmentModel ?? "",
      equipmentSpecifications: prDetail.equipmentSpecifications ?? "",
      equipmentOtherDetails: prDetail.equipmentOtherDetails ?? "",
      columns: prDetail.columns,
      lineItems: prDetail.lineItems.map((item) => ({
        description: item.description,
        qty: item.qty,
        extra: item.extra,
      })),
    };

    const templateBuffer = await TEMPLATE_BUFFER_READER[category]();
    const workbook = new ExcelJS.Workbook();
    // exceljs's own type defs (index.d.ts:1) declare a bare `interface Buffer
    // extends ArrayBuffer {}` with no import/export in that file, which
    // globally augments the ambient Buffer interface for the whole program
    // to also require ArrayBuffer's own members — a real Node Buffer
    // instance's type doesn't structurally satisfy that augmented shape, so
    // no cast target named `Buffer` can ever type-check here; `any` is the
    // only way through a third-party .d.ts bug, not a real runtime concern
    // (readFile()'s actual return value is exactly what .load() expects).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(templateBuffer as any);
    const sheet = workbook.getWorksheet(SHEET_NAME[category]);
    if (!sheet) {
      throw new Error(`Template sheet "${SHEET_NAME[category]}" not found in ${category} template.`);
    }

    // ExcelJS has no support at all for chart sheets (a workbook part type
    // distinct from a regular worksheet) — it silently drops one from the
    // model on load with no error, rather than round-tripping it. The Spares
    // template carries exactly one such leftover sheet ("Chart1"), and once
    // it's dropped, the workbook's own bookView state (activeTab/firstSheet,
    // copied straight through from the loaded XML) still points at that
    // sheet's original tab index — now out of range against the single
    // surviving worksheet, which is what made Excel flag the exported file as
    // needing repair even though every cell/merge/style was otherwise intact.
    // Forcing both back to the one real sheet fixes it for every category,
    // not just Spares' own template.
    workbook.views = workbook.views.map((view) => ({ ...view, firstSheet: 0, activeTab: 0 }));

    FILL_TEMPLATE[category](sheet, data);

    const outBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${prDetail.prNumber}-export.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[api/purchase-requisitions/[id]/export:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't export this requisition." } }, { status: 500 });
  }
}
