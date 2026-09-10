import type { InputHTMLAttributes, ReactNode } from "react";

// Ref: Design-docs/design-spec.html §05 — Form controls. Error state is a
// rust border + rust helper text replacing the neutral helper, validated
// inline rather than only on submit.
export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  endAdornment?: ReactNode;
  startAdornment?: ReactNode;
};

export function Input({ error, endAdornment, startAdornment, className = "", ...props }: InputProps) {
  return (
    <div>
      <div className={endAdornment || startAdornment ? "relative" : undefined}>
        <input
          aria-invalid={!!error}
          className={[
            "w-full rounded-md border bg-paper px-2.5 py-2 text-[13.5px] text-ink",
            "focus:border-harbor focus:outline-none",
            error ? "border-rust" : "border-line",
            endAdornment ? "pr-14" : "",
            startAdornment ? "pl-8" : "",
            className,
          ].join(" ")}
          {...props}
        />
        {startAdornment ? (
          <div className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-lt">{startAdornment}</div>
        ) : null}
        {endAdornment ? (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">{endAdornment}</div>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-[11px] text-rust">{error}</p> : null}
    </div>
  );
}
