import type { SelectHTMLAttributes } from "react";

// Ref: Design-docs/design-spec.html §05 — Form controls (`.field select`).
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
};

export function Select({ error, className = "", children, ...props }: SelectProps) {
  return (
    <div>
      <div className="relative">
        <select
          aria-invalid={!!error}
          className={[
            "w-full appearance-none rounded-md border bg-paper px-2.5 py-2 pr-8 text-[13.5px] text-ink",
            "focus:border-harbor focus:outline-none",
            error ? "border-rust" : "border-line",
            className,
          ].join(" ")}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-lt"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error ? <p className="mt-1 text-[11px] text-rust">{error}</p> : null}
    </div>
  );
}
