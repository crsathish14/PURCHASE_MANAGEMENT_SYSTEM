import type { LabelHTMLAttributes } from "react";

// Ref: Design-docs/design-spec.html §05 — Form controls. Label always sits
// above the field (never placeholder-as-label); turns rust when the field
// it describes has a validation error.
export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  error?: boolean;
};

export function Label({ error = false, className = "", ...props }: LabelProps) {
  return (
    <label
      className={`mb-1.5 block text-xs font-bold ${error ? "text-rust" : "text-ink"} ${className}`}
      {...props}
    />
  );
}
