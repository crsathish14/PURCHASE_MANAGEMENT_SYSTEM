"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Input, Spinner } from "@/components/atoms";
import en from "@/locales/en.json";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import { DateRangeFilter, presetLabel } from "./date-range-filter";
import { FilterMultiselect, type FilterOption } from "./filter-multiselect";

const t = en.staff.poRequests.toolbar;

const APPLIED_CHIP_CLASS = "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[12px] font-bold";

export type PrToolbarProps = {
  statusOptions: FilterOption[];
  vesselOptions: FilterOption[];
  categoryOptions: FilterOption[];
  appliedStatuses: string[];
  appliedVessels: string[];
  appliedCategories: string[];
  appliedDatePreset: DatePreset | null;
  appliedStartDate: string | null;
  appliedEndDate: string | null;
  // Fired after the search box has been idle for 1s — combined by the parent
  // with whatever's currently *applied* (not staged/draft) for the other 3
  // filters, since search auto-applies independently of Submit.
  onSearchSettled: (search: string) => void;
  // Fired immediately on Submit, carrying the live search text (bypassing
  // the debounce, same as Clear does) plus the currently staged selections.
  onSubmit: (params: {
    search: string;
    statuses: string[];
    vessels: string[];
    categories: string[];
    datePreset: DatePreset | null;
    startDate: string | null;
    endDate: string | null;
  }) => void;
  onClear: () => void;
  submitting?: boolean;
};

type ChipCategory = "status" | "vessel" | "category" | "date";

// Search/filter UI matches Design-docs/app/po-requests.html's toolbar
// structure (search box + 4 filter dropdowns + Clear link), plus a Submit
// CTA the mock doesn't have — added per an explicit product requirement, not
// a mock deviation.
//
// Ownership split: this component owns transient UI state (live search text,
// staged/draft filter selections). The parent (PoRequestsView) owns what's
// actually been applied/fetched and passes it down as appliedStatuses/
// appliedVessels/appliedCategories/appliedDatePreset/appliedStartDate/
// appliedEndDate, purely so each chip can be colored correctly — green if its
// value is in the applied set, grey if it's only staged. The parent remounts
// this component (via a `key` bump) to reset it on Clear, rather than this
// component reading a reset signal itself.
export function PrToolbar({
  statusOptions,
  vesselOptions,
  categoryOptions,
  appliedStatuses,
  appliedVessels,
  appliedCategories,
  appliedDatePreset,
  appliedStartDate,
  appliedEndDate,
  onSearchSettled,
  onSubmit,
  onClear,
  submitting = false,
}: PrToolbarProps) {
  const [searchInput, setSearchInput] = useState("");
  const [draftStatuses, setDraftStatuses] = useState<string[]>(appliedStatuses);
  const [draftVessels, setDraftVessels] = useState<string[]>(appliedVessels);
  const [draftCategories, setDraftCategories] = useState<string[]>(appliedCategories);
  const [draftDatePreset, setDraftDatePreset] = useState<DatePreset | null>(appliedDatePreset);
  const [draftStartDate, setDraftStartDate] = useState<string | null>(appliedStartDate);
  const [draftEndDate, setDraftEndDate] = useState<string | null>(appliedEndDate);

  const debouncedSearch = useDebouncedValue(searchInput, 1000);

  // Only fires when debouncedSearch actually changes from what was last
  // fired — not a "have I run before" boolean flag, because React
  // StrictMode's dev-only mount→unmount→remount double-invocation of effects
  // would flip a boolean guard on its first (discarded) run and then
  // incorrectly skip the guard on the second (real) run, firing a stale
  // fetch. A value-comparison guard is idempotent under that replay: running
  // the same comparison twice with the same values is a no-op both times.
  const lastFiredSearchRef = useRef(searchInput);
  const onSearchSettledRef = useRef(onSearchSettled);
  useEffect(() => {
    onSearchSettledRef.current = onSearchSettled;
  });
  useEffect(() => {
    if (debouncedSearch === lastFiredSearchRef.current) return;
    lastFiredSearchRef.current = debouncedSearch;
    onSearchSettledRef.current(debouncedSearch);
  }, [debouncedSearch]);

  function nSelectedLabel(count: number) {
    return t.nSelected.replace("{count}", String(count));
  }

  function toggleDraft(category: ChipCategory, value: string) {
    if (category === "date") {
      setDraftDatePreset(null);
      setDraftStartDate(null);
      setDraftEndDate(null);
      return;
    }
    const setters = { status: setDraftStatuses, vessel: setDraftVessels, category: setDraftCategories };
    setters[category]((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  const chips = [
    ...draftStatuses.map((value) => ({
      category: "status" as const,
      value,
      label: statusOptions.find((option) => option.value === value)?.label ?? value,
      applied: appliedStatuses.includes(value),
    })),
    ...draftVessels.map((value) => ({
      category: "vessel" as const,
      value,
      label: vesselOptions.find((option) => option.value === value)?.label ?? value,
      applied: appliedVessels.includes(value),
    })),
    ...draftCategories.map((value) => ({
      category: "category" as const,
      value,
      label: categoryOptions.find((option) => option.value === value)?.label ?? value,
      applied: appliedCategories.includes(value),
    })),
    ...(draftDatePreset
      ? [
          {
            category: "date" as const,
            value: draftDatePreset,
            label: presetLabel(draftDatePreset),
            applied:
              appliedDatePreset === draftDatePreset &&
              (draftDatePreset !== DATE_PRESET.CUSTOM ||
                (appliedStartDate === draftStartDate && appliedEndDate === draftEndDate)),
          },
        ]
      : []),
  ];

  const hasAnything =
    searchInput.length > 0 ||
    chips.length > 0 ||
    appliedStatuses.length > 0 ||
    appliedVessels.length > 0 ||
    appliedCategories.length > 0 ||
    appliedDatePreset !== null;

  return (
    <div className="mb-3 rounded-xl border border-line bg-paper p-3.5 shadow-(--shadow-e1)">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-42.5 max-w-65 flex-1">
          <Input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t.searchPlaceholder}
            startAdornment={<SearchIcon />}
            className="py-2 text-[13px]"
          />
        </div>

        <FilterMultiselect
          label={t.status}
          options={statusOptions}
          selected={draftStatuses}
          onChange={setDraftStatuses}
          allLabel={t.all}
          nSelectedLabel={nSelectedLabel}
        />
        <FilterMultiselect
          label={t.vessel}
          options={vesselOptions}
          selected={draftVessels}
          onChange={setDraftVessels}
          allLabel={t.all}
          nSelectedLabel={nSelectedLabel}
        />
        <FilterMultiselect
          label={t.category}
          options={categoryOptions}
          selected={draftCategories}
          onChange={setDraftCategories}
          allLabel={t.all}
          nSelectedLabel={nSelectedLabel}
        />

        <DateRangeFilter
          label={t.date}
          allLabel={t.any}
          value={{ preset: draftDatePreset, startDate: draftStartDate, endDate: draftEndDate }}
          onChange={(next) => {
            setDraftDatePreset(next.preset);
            setDraftStartDate(next.startDate);
            setDraftEndDate(next.endDate);
          }}
        />

        <button
          type="button"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px] font-bold text-ink disabled:opacity-60"
          onClick={() =>
            onSubmit({
              search: searchInput,
              statuses: draftStatuses,
              vessels: draftVessels,
              categories: draftCategories,
              datePreset: draftDatePreset,
              startDate: draftStartDate,
              endDate: draftEndDate,
            })
          }
        >
          {submitting ? <Spinner size="sm" /> : null}
          {t.submit}
        </button>
        <button
          type="button"
          className="ml-0.5 text-[12.5px] font-bold text-harbor disabled:pointer-events-none disabled:opacity-40"
          disabled={!hasAnything}
          onClick={() => {
            setSearchInput("");
            setDraftStatuses([]);
            setDraftVessels([]);
            setDraftCategories([]);
            setDraftDatePreset(null);
            setDraftStartDate(null);
            setDraftEndDate(null);
            onClear();
          }}
        >
          {t.clear}
        </button>
      </div>

      {chips.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={`${chip.category}-${chip.value}`}
              className={`${APPLIED_CHIP_CLASS} ${chip.applied ? "bg-moss-bg text-moss" : "bg-chip-bg text-chip"}`}
            >
              {chip.label}
              <button
                type="button"
                aria-label={t.removeFilter.replace("{label}", chip.label)}
                onClick={() => toggleDraft(chip.category, chip.value)}
                className="opacity-70 hover:opacity-100"
              >
                <X size={11} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
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
