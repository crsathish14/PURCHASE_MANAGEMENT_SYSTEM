import { NextResponse } from "next/server";

import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { PrCategory } from "@/lib/constants/purchase-requisition";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { readSparesTemplateBuffer, readStoresTemplateBuffer } from "@/lib/purchase-requisition/templates";

// Both categories ship their real, VBA-driven paper-form workbook (persisted
// as-is under lib/purchase-requisition/templates/ — see that folder's
// vba-source/stores/ and vba-source/spares/ for the readable macro code and
// setup guides, two independent VBA projects) instead of an ExcelJS-built
// one — a generic spreadsheet library can't safely author a workbook with a
// live VBA project (buttons, protection, Ctrl+V binding), so unlike a plain
// generated template these are static assets, not rebuilt per request. The
// legacy ExcelJS-generated template (matched by import-template.ts's
// `_pms_meta` marker sheet) and its category-specific header fields are no
// longer produced by this route for either category — kept in the parser
// only for files already downloaded before this change.
export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  if (categoryParam !== PR_CATEGORY.STORES && categoryParam !== PR_CATEGORY.SPARES) {
    return NextResponse.json(
      { error: { message: "Unknown or unsupported template category." } },
      { status: 400 },
    );
  }
  const category: PrCategory = categoryParam;

  let buffer: Buffer;
  try {
    buffer = category === PR_CATEGORY.STORES ? await readStoresTemplateBuffer() : await readSparesTemplateBuffer();
  } catch (error) {
    console.error("[api/purchase-requisitions/import-template:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't build the template." } }, { status: 500 });
  }

  const fileName =
    category === PR_CATEGORY.STORES ? "pms-store-requisition-template.xlsm" : "pms-spares-requisition-template.xlsm";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
