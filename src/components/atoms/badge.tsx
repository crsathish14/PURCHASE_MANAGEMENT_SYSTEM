import type { ReactNode } from "react";

// Ref: Design-docs/design-spec.html §05 Component library — Status chips.
// Semantic tone only — never the harbor accent for status, so status always
// reads distinctly from interactive elements (per the design spec).
export type BadgeTone = "moss" | "amber" | "rust" | "teal" | "harbor" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  moss: "bg-moss-bg text-moss",
  amber: "bg-amber-bg text-amber",
  rust: "bg-rust-bg text-rust",
  teal: "bg-teal-bg text-teal",
  harbor: "bg-harbor-50 text-harbor",
  slate: "bg-chip-bg text-chip",
};

export type BadgeProps = {
  tone: BadgeTone;
  children: ReactNode;
};

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
