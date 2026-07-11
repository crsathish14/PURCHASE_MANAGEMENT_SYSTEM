import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "md" | "sm";

// Ref: Design-docs/design-spec.html §05 Component library — Buttons.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-harbor text-paper hover:brightness-105",
  secondary: "border-line bg-paper text-ink hover:bg-mist",
  ghost: "border-transparent bg-transparent text-harbor hover:bg-harbor-50",
  danger: "border-transparent bg-rust text-paper hover:brightness-105",
  icon: "h-[34px] w-[34px] justify-center border-line bg-paper p-0 text-slate hover:bg-mist",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-4 py-2.5 text-[13px]",
  sm: "px-3 py-1.5 text-[12.5px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-bold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "icon" ? "" : SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
