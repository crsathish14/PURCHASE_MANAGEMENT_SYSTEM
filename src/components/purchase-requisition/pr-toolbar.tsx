"use client";

import en from "@/locales/en.json";

const t = en.staff.poRequests.toolbar;

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink";

// Presentational only — no search/filter functionality yet. Structure and
// copy match Design-docs/app/po-requests.html's toolbar; chip values read
// "All"/"Any" rather than the mock's example "Pending RFQ", since nothing is
// actually filtered here — an applied-looking filter with no effect would be
// misleading.
export function PrToolbar() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-paper p-3.5 shadow-(--shadow-e1)">
      <div className="flex min-w-[170px] max-w-65 flex-1 items-center gap-2 rounded-md border border-line px-2.5 py-2 text-[13px] text-slate-lt">
        <SearchIcon />
        {t.searchPlaceholder}
      </div>
      <span className={CHIP_CLASS}>
        {t.status}: {t.all}
        <ChevronIcon />
      </span>
      <span className={CHIP_CLASS}>
        {t.vessel}: {t.all}
        <ChevronIcon />
      </span>
      <span className={CHIP_CLASS}>
        {t.category}: {t.all}
        <ChevronIcon />
      </span>
      <span className={CHIP_CLASS}>
        {t.date}: {t.any}
        <ChevronIcon />
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-lt" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
