"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button, Dialog, Input, Label, Textarea } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";
import { isValidNeededPoQty } from "@/components/purchase-orders/purchase-order-quantity-editor";
import { toast } from "@/store/toast-store";

const t = en.staff.purchaseOrders.issueDialog;
const tPo = en.staff.purchaseOrders;

type IssuePurchaseOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  requisitionId: string;
  prNumber: string;
  category: string | null;
  vendor: QuoteComparisonVendor;
  quantities: Record<string, string>;
  sameAsQuoteQty: boolean;
  onIssued: (link: string) => void;
};

type IssueResult = { link: string; message: string };

export function IssuePurchaseOrderDialog({
  open,
  onClose,
  requisitionId,
  prNumber,
  category,
  vendor,
  quantities,
  sameAsQuoteQty,
  onIssued,
}: IssuePurchaseOrderDialogProps) {
  const [message, setMessage] = useState(() =>
    t.messageTemplate.replace("{vendorName}", vendor.vendorName).replace("{prNumber}", prNumber),
  );
  const [result, setResult] = useState<IssueResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const hasQuantityFields = category === PR_CATEGORY.STORES || category === PR_CATEGORY.SPARES;
  const quantitiesValid =
    !hasQuantityFields || vendor.lineItems.every((item) => isValidNeededPoQty(quantities[item.quotationItemId] ?? ""));
  const vendorEmail = vendor.vendorEmail?.trim() ?? "";

  function close() {
    if (creating) return;
    onClose();
  }

  async function copyToClipboard(value: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 1500);
    } catch {
      // The text remains visible and selectable if clipboard access is denied.
    }
  }

  async function createLink() {
    if (!vendorEmail || !message.trim() || !quantitiesValid) {
      if (!quantitiesValid) toast.error(tPo.invalidDraft);
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`/api/purchase-orders/${requisitionId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sameAsQuoteQty: hasQuantityFields ? sameAsQuoteQty : false,
          items: hasQuantityFields
            ? vendor.lineItems.map((item) => ({
                quotationItemId: item.quotationItemId,
                neededPoQty: Number(quantities[item.quotationItemId]),
              }))
            : [],
          message,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? tPo.issueError);
        return;
      }

      setResult({ link: payload.data.link, message: payload.data.message });
      onIssued(payload.data.link);
    } catch {
      toast.error(tPo.issueError);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={result ? t.resultTitle : `${t.title} — ${prNumber}`}
      zIndexClassName="z-50"
      footer={
        result ? (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {t.done}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={close} disabled={creating}>
              {t.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => void createLink()}
              loading={creating}
              disabled={!vendorEmail || !message.trim() || !quantitiesValid}
            >
              {creating ? t.creatingLink : t.createLink}
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <>
          <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.resultDescription}</p>
          <div className="mb-4">
            <Label htmlFor="po-result-link">{t.link}</Label>
            <Input
              id="po-result-link"
              readOnly
              value={result.link}
              onFocus={(event) => event.currentTarget.select()}
              endAdornment={
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyToClipboard(result.link, "link")}>
                  {copied === "link" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                  {copied === "link" ? t.copied : t.copy}
                </Button>
              }
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="po-result-message" className="text-xs font-bold text-ink">
                {t.message}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void copyToClipboard(result.message, "message")}
              >
                {copied === "message" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                {copied === "message" ? t.copied : t.copy}
              </Button>
            </div>
            <Textarea id="po-result-message" readOnly rows={7} value={result.message} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-5 text-[13px] leading-relaxed text-slate">{t.description}</p>
          <div className="mb-4">
            <Label htmlFor="po-vendor-name">{t.vendorName}</Label>
            <Input id="po-vendor-name" readOnly value={vendor.vendorName} />
          </div>
          <div className="mb-4">
            <Label htmlFor="po-vendor-email">{t.vendorEmail}</Label>
            <Input id="po-vendor-email" readOnly value={vendorEmail} />
          </div>
          <div>
            <Label htmlFor="po-message">{t.message}</Label>
            <Textarea
              id="po-message"
              rows={7}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={creating}
            />
          </div>
          {!vendorEmail ? <p className="mt-2 text-xs text-rust">{tPo.vendorEmailMissing}</p> : null}
        </>
      )}
    </Dialog>
  );
}
