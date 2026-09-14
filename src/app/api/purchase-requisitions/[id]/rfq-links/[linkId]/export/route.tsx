import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { PR_CATEGORY, type PrCategory } from "@/lib/constants/purchase-requisition";
import { getRfqQuoteComparison } from "@/lib/data/rfq-quote-comparison";
import { buildRfqQuotePdfFilename } from "@/lib/rfq-quote-pdf/filename";
import type { RfqQuotePdfPrContext } from "@/lib/rfq-quote-pdf/sections";
import { ServiceQuotePdf } from "@/lib/rfq-quote-pdf/service-quote-pdf";
import { SparesQuotePdf } from "@/lib/rfq-quote-pdf/spares-quote-pdf";
import { StoresQuotePdf } from "@/lib/rfq-quote-pdf/stores-quote-pdf";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.requestedQuote.linksDialog;

// Same lenient default-to-Stores behavior compare-quotes-modal.tsx already
// uses for this same nullable field, not the stricter isPrCategory 400-guard
// the unrelated Excel export route uses — this route's whole job is "a
// static copy of what Compare Quotes already shows for this vendor," so it
// should degrade exactly the way Compare Quotes itself already does on this
// same field.
const PDF_DOCUMENT_BY_CATEGORY: Record<PrCategory, typeof StoresQuotePdf> = {
  [PR_CATEGORY.STORES]: StoresQuotePdf,
  [PR_CATEGORY.SPARES]: SparesQuotePdf,
  [PR_CATEGORY.SERVICE]: ServiceQuotePdf,
};

// GET /api/purchase-requisitions/[id]/rfq-links/[linkId]/export — downloads
// one vendor's received RFQ quote as a PDF styled after the original vendor
// quote form, populated with that vendor's actual submitted data. Reuses
// getRfqQuoteComparison (the same data Compare Quotes already reads) rather
// than a new data-layer function — narrowed to a single linkId.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id, linkId } = await params;

  try {
    const data = await getRfqQuoteComparison(id, [linkId]);
    if (!data) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }

    // vendors[] is shorter than the requested linkIds whenever a link has no
    // matching quotation (reissued away since the row was rendered, a
    // stale/bad id, or a linkId belonging to a different requisition) — all
    // three collapse to this one clean 404, never an index-into-undefined
    // crash.
    const vendor = data.vendors[0];
    if (!vendor) {
      return NextResponse.json({ error: { message: t.exportPdfNotFoundError } }, { status: 404 });
    }

    const category: PrCategory =
      data.category === PR_CATEGORY.SPARES
        ? PR_CATEGORY.SPARES
        : data.category === PR_CATEGORY.SERVICE
          ? PR_CATEGORY.SERVICE
          : PR_CATEGORY.STORES;

    const pr: RfqQuotePdfPrContext = {
      prNumber: data.prNumber,
      vesselLabel: data.vesselLabel,
      vesselImoNo: data.vesselImoNo,
      requisitionDate: data.requisitionDate,
      requiredPort: data.requiredPort,
      requiredDate: data.requiredDate,
      equipmentName: data.equipmentName,
      equipmentType: data.equipmentType,
      equipmentMake: data.equipmentMake,
      equipmentSerialNo: data.equipmentSerialNo,
      equipmentModel: data.equipmentModel,
      equipmentSpecifications: data.equipmentSpecifications,
      equipmentOtherDetails: data.equipmentOtherDetails,
    };

    const PdfDocument = PDF_DOCUMENT_BY_CATEGORY[category];
    const buffer = await renderToBuffer(<PdfDocument vendor={vendor} pr={pr} />);
    const filename = buildRfqQuotePdfFilename(data.prNumber, vendor.vendorName);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[api/purchase-requisitions/[id]/rfq-links/[linkId]/export:GET]", error);
    return NextResponse.json({ error: { message: t.exportPdfError } }, { status: 500 });
  }
}
