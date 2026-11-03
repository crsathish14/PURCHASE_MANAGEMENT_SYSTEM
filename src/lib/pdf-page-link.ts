import { env } from "@/lib/env";
import { pathWithPrSearch, ROUTES } from "@/lib/routes";

function staffPageWithPrSearch(route: string, prNumber: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}${pathWithPrSearch(route, prNumber)}`;
}

export function rfqPageUrlForPr(prNumber: string): string {
  return staffPageWithPrSearch(ROUTES.RFQ_LIST, prNumber);
}

export function purchaseOrdersPageUrlForPr(prNumber: string): string {
  return staffPageWithPrSearch(ROUTES.PURCHASE_ORDERS, prNumber);
}
