"use client";

import Link from "next/link";

import { Button, Dialog } from "@/components/atoms";
import en from "@/locales/en.json";
import { pathWithPrSearch, ROUTES } from "@/lib/routes";

const t = en.staff.invoiceLog.prLinksDialog;

export type PrLinksDialogProps = {
  open: boolean;
  onClose: () => void;
  prNumber: string;
};

// Quick navigation from an Invoice Log row to the same PR on the other list
// pages, each opened pre-filtered by the PR number.
export function PrLinksDialog({ open, onClose, prNumber }: PrLinksDialogProps) {
  const links = [
    { label: t.links.purchaseRequisition, href: pathWithPrSearch(ROUTES.PO_REQUESTS, prNumber) },
    { label: t.links.rfq, href: pathWithPrSearch(ROUTES.RFQ_LIST, prNumber) },
    { label: t.links.purchaseOrder, href: pathWithPrSearch(ROUTES.PURCHASE_ORDERS, prNumber) },
  ];

  return (
    <Dialog open={open} onClose={onClose} title={t.title.replace("{prNumber}", prNumber)}>
      <p className="text-sm text-slate">{t.description}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm font-semibold text-harbor transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
            >
              {link.label}
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </Dialog>
  );
}
