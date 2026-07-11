import type { InputHTMLAttributes } from "react";

// Ref: Design-docs/design-spec.html §05 — Form controls. Error state is a
// rust border + rust helper text replacing the neutral helper, validated
// inline rather than only on submit.
export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ error, className = "", ...props }: InputProps) {
  return (
    <div>
      <input
        aria-invalid={!!error}
        className={[
          "w-full rounded-md border bg-paper px-2.5 py-2 text-[13.5px] text-ink",
          "focus:border-harbor focus:outline-none",
          error ? "border-rust" : "border-line",
          className,
        ].join(" ")}
        {...props}
      />
      {error ? <p className="mt-1 text-[11px] text-rust">{error}</p> : null}
    </div>
  );
}
