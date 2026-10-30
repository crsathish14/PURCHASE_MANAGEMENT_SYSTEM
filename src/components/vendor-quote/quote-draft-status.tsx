"use client";

import en from "@/locales/en.json";
import type { DraftSaveState } from "./use-quote-draft";
import { useMinuteTick } from "./use-minute-tick";

const t = en.vendorQuote.draft;

export type QuoteDraftStatusProps = {
  state: DraftSaveState;
};

export function QuoteDraftStatus({ state }: QuoteDraftStatusProps) {
  // The saved time is formatted in the browser's locale/timezone, which the
  // server can't know — withheld until the client takes over, like the
  // expiry countdown.
  const clientReady = useMinuteTick() !== null;

  let text: string = t.idle;
  if (state.status === "saving") {
    text = t.saving;
  } else if (state.status === "error") {
    text = t.error;
  } else if (state.status === "saved" && state.savedAt && clientReady) {
    text = t.saved.replace(
      "{time}",
      state.savedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-[12.5px] ${state.status === "error" ? "text-rust" : "text-slate-lt"}`}
    >
      {text}
    </span>
  );
}
