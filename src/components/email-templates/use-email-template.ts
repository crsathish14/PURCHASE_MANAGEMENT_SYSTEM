"use client";

import { useEffect, useState } from "react";

import type { EmailTemplateKey } from "@/lib/constants/email-template";

type Loaded =
  | { requisitionId: string; status: "ready"; subject: string; body: string }
  | { requisitionId: string; status: "error" };

export type EmailTemplateState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; subject: string; body: string };

// Fetches the saved template for `key` with this requisition's vessel / requisition no. /
// title filled in ([Insert Link] is left for the server to fill once the link exists).
// Nothing the user types in a dialog is ever written back — only Settings > Email Templates
// changes the saved template.
export function useEmailTemplate(key: EmailTemplateKey, requisitionId: string): EmailTemplateState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!requisitionId) return;

    let active = true;
    async function load() {
      try {
        const response = await fetch(
          `/api/email-templates/${key}/render?${new URLSearchParams({ requisitionId }).toString()}`,
        );
        const payload = (await response.json()) as { data?: { subject: string; body: string } };
        if (!response.ok || !payload.data) throw new Error("Email template lookup failed");
        if (active) {
          setLoaded({ requisitionId, status: "ready", subject: payload.data.subject, body: payload.data.body });
        }
      } catch {
        if (active) setLoaded({ requisitionId, status: "error" });
      }
    }

    void load();
    return () => {
      active = false;
      // Drop the result so reopening for the same requisition refetches — the template
      // may have been edited in Settings in the meantime.
      setLoaded(null);
    };
  }, [key, requisitionId]);

  // A result for a different requisition (or none yet) counts as still loading.
  if (!loaded || loaded.requisitionId !== requisitionId) return { status: "loading" };
  return loaded.status === "ready"
    ? { status: "ready", subject: loaded.subject, body: loaded.body }
    : { status: "error" };
}
