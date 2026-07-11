import type { InputHTMLAttributes } from "react";

// Ref: Design-docs/design-spec.html §05 — Table row (leading checkbox col).
export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export function Checkbox({ className = "", ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={[
        "h-4 w-4 rounded border-line accent-harbor",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor",
        "disabled:opacity-40",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
