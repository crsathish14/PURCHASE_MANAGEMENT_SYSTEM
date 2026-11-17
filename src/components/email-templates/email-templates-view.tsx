"use client";

import { useState } from "react";

import { Button, Input, Label, Textarea } from "@/components/atoms";
import { SettingsSubnav } from "@/components/settings/subnav";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_PLACEHOLDER,
  type EmailTemplateKey,
} from "@/lib/constants/email-template";
import type { EmailTemplate } from "@/lib/data/email-templates";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";

const t = en.staff.emailTemplates;
const P = EMAIL_TEMPLATE_PLACEHOLDER;

const PLACEHOLDER_ROWS = [
  { token: P.VESSEL_NAME, description: t.placeholders.vesselName },
  { token: P.REQUISITION_NO, description: t.placeholders.requisitionNo },
  { token: P.TITLE, description: t.placeholders.title },
  { token: P.COMPANY_NAME, description: t.placeholders.companyName },
  { token: P.LINK, description: t.placeholders.link },
];

type Draft = { subject: string; body: string };

function TemplateCard({
  template,
  onSaved,
}: {
  template: EmailTemplate;
  onSaved: (template: EmailTemplate) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ subject: template.subject, body: template.body });
  const [saving, setSaving] = useState(false);

  const copy = t.templates[template.key];
  const dirty = draft.subject !== template.subject || draft.body !== template.body;
  const valid = draft.subject.trim().length > 0 && draft.body.trim().length > 0;
  const missingLink = !draft.body.includes(P.LINK);

  async function handleSave() {
    if (!dirty || !valid || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/email-templates/${template.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: EmailTemplate;
        error?: { message: string };
      } | null;

      if (!response.ok || !payload?.data) {
        toast.error(payload?.error?.message ?? t.saveError);
        return;
      }

      onSaved(payload.data);
      setDraft({ subject: payload.data.subject, body: payload.data.body });
      toast.success(t.saved);
    } catch {
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-paper p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{copy.name}</h2>
      <p className="mt-1 mb-4 text-[13px] text-slate">{copy.description}</p>

      <div className="mb-4">
        <Label htmlFor={`email-subject-${template.key}`} required>
          {t.subjectLabel}
        </Label>
        <Input
          id={`email-subject-${template.key}`}
          value={draft.subject}
          maxLength={300}
          disabled={saving}
          onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
        />
      </div>

      <div className="mb-3">
        <Label htmlFor={`email-body-${template.key}`} required>
          {t.bodyLabel}
        </Label>
        <Textarea
          id={`email-body-${template.key}`}
          rows={16}
          value={draft.body}
          maxLength={10000}
          disabled={saving}
          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
        />
        {missingLink ? <p className="mt-1 text-[11px] text-rust">{t.linkPlaceholderWarning}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-lt">
          {t.updatedAt.replace("{date}", new Date(template.updatedAt).toLocaleString())}
        </span>
        <Button
          type="button"
          onClick={() => void handleSave()}
          loading={saving}
          disabled={!dirty || !valid}
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </section>
  );
}

export function EmailTemplatesView({ initialTemplates }: { initialTemplates: EmailTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);

  const byKey = new Map<EmailTemplateKey, EmailTemplate>(templates.map((row) => [row.key, row]));

  function handleSaved(saved: EmailTemplate) {
    setTemplates((current) => current.map((row) => (row.key === saved.key ? saved : row)));
  }

  return (
    <div>
      <p className="mb-3.5 text-xs text-slate-lt">
        {t.breadcrumbSettings}
        <span className="mx-1.5">›</span>
        <b className="font-semibold text-ink">{t.breadcrumbCurrent}</b>
      </p>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
        <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <SettingsSubnav active="emailTemplates" />

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-mist/50 p-5">
            <h2 className="text-xs font-bold tracking-wide text-ink uppercase">{t.placeholdersTitle}</h2>
            <p className="mt-1 mb-3 text-[13px] text-slate">{t.placeholdersHint}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr]">
              {PLACEHOLDER_ROWS.map((row) => (
                <div key={row.token} className="contents">
                  <dt className="font-mono font-semibold text-ink">{row.token}</dt>
                  <dd className="text-slate">{row.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          {EMAIL_TEMPLATE_KEYS.map((key) => {
            const template = byKey.get(key);
            return template ? <TemplateCard key={key} template={template} onSaved={handleSaved} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}
