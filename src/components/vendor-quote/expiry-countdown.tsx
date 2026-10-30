"use client";

import en from "@/locales/en.json";
import { useMinuteTick } from "./use-minute-tick";

const t = en.vendorQuote.expiry;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRemaining(remainingMs: number): string {
  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);

  // Leading zero units are dropped ("5h 30m", not "0d 5h 30m"); seconds are
  // deliberately never shown.
  const parts: string[] = [];
  if (days > 0) parts.push(t.days.replace("{count}", String(days)));
  if (days > 0 || hours > 0) parts.push(t.hours.replace("{count}", String(hours)));
  parts.push(t.minutes.replace("{count}", String(minutes)));
  return parts.join(" ");
}

export type ExpiryCountdownProps = {
  expiresAt: string;
};

export function ExpiryCountdown({ expiresAt }: ExpiryCountdownProps) {
  const now = useMinuteTick();
  if (now === null) return null;

  const expiresMs = new Date(expiresAt).getTime();
  const remainingMs = expiresMs - now;
  const isExpired = remainingMs <= 0;
  // Under a day left is the "act soon" zone.
  const isUrgent = remainingMs < DAY_MS;

  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-mist px-3 py-2 text-[13px]"
      title={new Date(expiresMs).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
    >
      <span className="text-slate">{isExpired ? t.expiredLabel : t.label}</span>
      <span className={`font-mono font-semibold ${isExpired || isUrgent ? "text-rust" : "text-ink"}`}>
        {isExpired ? t.expired : remainingMs < MINUTE_MS ? t.lessThanMinute : formatRemaining(remainingMs)}
      </span>
    </div>
  );
}
