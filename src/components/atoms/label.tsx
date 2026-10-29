import type { LabelHTMLAttributes } from "react";

import { RequiredMark } from "./required-mark";

// Ref: Design-docs/design-spec.html §05 — Form controls. Label always sits
// above the field (never placeholder-as-label); turns rust when the field
// it describes has a validation error. `required` appends the red asterisk
// for a mandatory field.
export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  error?: boolean;
  required?: boolean;
};

export function Label({ error = false, required = false, className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={`mb-1.5 block text-xs font-bold ${error ? "text-rust" : "text-ink"} ${className}`}
      {...props}
    >
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}
