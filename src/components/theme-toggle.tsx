"use client";

import en from "@/locales/en.json";
import { useThemeStore, type ThemePreference } from "@/store/theme-store";

const OPTIONS: ThemePreference[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div
      role="group"
      aria-label={en.theme.label}
      className="inline-flex rounded-md border border-line bg-paper p-1 text-xs"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setPreference(option)}
          aria-pressed={preference === option}
          className={
            "rounded px-3 py-1 font-medium transition-colors " +
            (preference === option
              ? "bg-harbor text-paper"
              : "text-slate hover:text-ink")
          }
        >
          {en.theme[option]}
        </button>
      ))}
    </div>
  );
}
