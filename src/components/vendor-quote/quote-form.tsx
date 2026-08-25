"use client";

import { useState } from "react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";

const t = en.vendorQuote;

export function QuoteForm({ token, prNumber }: { token: string; prNumber: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/quote/${token}/submit`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.submitError);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error(t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="font-display text-[23px] font-semibold text-ink">{t.submittedTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">{t.submittedDescription}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs font-bold tracking-wide text-slate-lt uppercase">{t.refLabel}</p>
      <p className="mt-1 font-mono text-lg text-ink">{prNumber}</p>
      <p className="mt-4 text-sm leading-relaxed text-slate">{t.description}</p>
      <Button variant="primary" onClick={handleSubmit} loading={submitting} className="mt-6 w-full">
        {submitting ? t.submitting : t.submit}
      </Button>
    </div>
  );
}
