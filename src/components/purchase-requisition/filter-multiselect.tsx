"use client";

import { Checkbox, Menu } from "@/components/atoms";

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterMultiselectProps = {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  nSelectedLabel: (count: number) => string;
};

// One reusable dropdown-with-checkboxes for the toolbar's Status/Vessel/Category
// filters — Menu with closeOnContentClick={false} so toggling one checkbox
// doesn't dismiss the panel before the user can select another.
export function FilterMultiselect({
  label,
  options,
  selected,
  onChange,
  allLabel,
  nSelectedLabel,
}: FilterMultiselectProps) {
  const active = selected.length > 0;

  function toggle(value: string) {
    onChange(active && selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <Menu
      align="left"
      closeOnContentClick={false}
      trigger={
        <button
          type="button"
          className={[
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12.5px]",
            active ? "border-transparent bg-harbor-50 font-bold text-harbor" : "border-line bg-paper text-ink",
          ].join(" ")}
        >
          {label}: {active ? nSelectedLabel(selected.length) : allLabel}
          <ChevronIcon />
        </button>
      }
    >
      <div className="max-h-64 overflow-y-auto py-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink hover:bg-mist"
          >
            <Checkbox checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </Menu>
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
