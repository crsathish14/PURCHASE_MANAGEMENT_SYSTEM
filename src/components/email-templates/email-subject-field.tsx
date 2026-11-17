"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.emailTemplates.dialog;
const tCopy = en.staff.poRequests.issueRfqDialog;

// The email subject, always read-only in the dialogs (it comes from the saved template).
// `copyable` adds a Copy button for the result screen, where staff paste it into their email.
export function EmailSubjectField({
  id,
  value,
  copyable = false,
}: {
  id: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The value stays visible and selectable if clipboard access is denied.
    }
  }

  return (
    <div className="mb-4">
      <Label htmlFor={id}>{t.subject}</Label>
      <Input
        id={id}
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className={copyable ? "pr-24" : undefined}
        endAdornment={
          copyable ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleCopy()}>
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
              {copied ? tCopy.copied : tCopy.copy}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
