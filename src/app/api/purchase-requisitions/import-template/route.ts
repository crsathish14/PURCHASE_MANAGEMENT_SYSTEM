import { NextResponse } from "next/server";

import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { PrCategory } from "@/lib/constants/purchase-requisition";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import {
  readServiceTemplateBuffer,
  readSparesTemplateBuffer,
  readStoresTemplateBuffer,
} from "@/lib/purchase-requisition/templates";

// Every category ships its real, VBA-driven paper-form workbook (persisted
// as-is under lib/purchase-requisition/templates/ — see that folder's
// vba-source/stores/, vba-source/spares/, and vba-source/service/ for the
// readable macro code and setup guides, three independent VBA projects)
// instead of an ExcelJS-built one — a generic spreadsheet library can't
// safely author a workbook with a live VBA project (buttons, protection,
// Ctrl+V binding), so unlike a plain generated template these are static
// assets, not rebuilt per request. The legacy ExcelJS-generated template
// (matched by import-template.ts's `_pms_meta` marker sheet) and its
// category-specific header fields are no longer produced by this route for
// any category — kept in the parser only for files already downloaded
// before that switch.
const TEMPLATE_BUFFER_READER: Record<PrCategory, () => Promise<Buffer>> = {
  [PR_CATEGORY.STORES]: readStoresTemplateBuffer,
  [PR_CATEGORY.SPARES]: readSparesTemplateBuffer,
  [PR_CATEGORY.SERVICE]: readServiceTemplateBuffer,
};
const TEMPLATE_FILE_NAME: Record<PrCategory, string> = {
  [PR_CATEGORY.STORES]: "pms-store-requisition-template.xlsm",
  [PR_CATEGORY.SPARES]: "pms-spares-requisition-template.xlsm",
  [PR_CATEGORY.SERVICE]: "pms-service-requisition-template.xlsm",
};

export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  if (
    categoryParam !== PR_CATEGORY.STORES &&
    categoryParam !== PR_CATEGORY.SPARES &&
    categoryParam !== PR_CATEGORY.SERVICE
  ) {
    return NextResponse.json(
      { error: { message: "Unknown or unsupported template category." } },
      { status: 400 },
    );
  }
  const category: PrCategory = categoryParam;

  let buffer: Buffer;
  try {
    buffer = await TEMPLATE_BUFFER_READER[category]();
  } catch (error) {
    console.error("[api/purchase-requisitions/import-template:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't build the template." } }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILE_NAME[category]}"`,
    },
  });
}
