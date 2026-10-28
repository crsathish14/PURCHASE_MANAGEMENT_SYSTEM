import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import {
  PR_CATEGORY,
  type PrCategoryWithCurrentPdfSupport,
} from "@/lib/constants/purchase-requisition";
import { getRfqQuoteComparison } from "@/lib/data/rfq-quote-comparison";
import { buildRfqQuotePdfFilename } from "@/lib/rfq-quote-pdf/filename";
import type { RfqQuotePdfPrContext } from "@/lib/rfq-quote-pdf/sections";
import { LoQuotePdf } from "@/lib/rfq-quote-pdf/lo-quote-pdf";
import { ServiceQuotePdf } from "@/lib/rfq-quote-pdf/service-quote-pdf";
import { SparesQuotePdf } from "@/lib/rfq-quote-pdf/spares-quote-pdf";
import { StoresQuotePdf } from "@/lib/rfq-quote-pdf/stores-quote-pdf";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.requestedQuote.linksDialog;

const PDF_DOCUMENT_BY_CATEGORY: Record<PrCategoryWithCurrentPdfSupport, typeof StoresQuotePdf> = {
  [PR_CATEGORY.STORES]: StoresQuotePdf,
  [PR_CATEGORY.SPARES]: SparesQuotePdf,
  [PR_CATEGORY.SERVICE]: ServiceQuotePdf,
  [PR_CATEGORY.LO]: LoQuotePdf,
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
    if (
      data.category !== PR_CATEGORY.STORES &&
      data.category !== PR_CATEGORY.SPARES &&
      data.category !== PR_CATEGORY.SERVICE &&
      data.category !== PR_CATEGORY.LO
    ) {
      return NextResponse.json({ error: { message: t.exportPdfUnsupportedCategory } }, { status: 400 });
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

    const category: PrCategoryWithCurrentPdfSupport = data.category;

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
