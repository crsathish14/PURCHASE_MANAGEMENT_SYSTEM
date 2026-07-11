"use client";

import { useEffect } from "react";

import { applyTheme, resolveTheme } from "@/lib/theme";
import { useThemeStore } from "@/store/theme-store";

// Mounted once in the root layout; renders nothing. Keeps <html data-theme>
// in sync with the store after hydration, and live-updates while the
// preference is "system" if the OS color scheme changes.
export function ThemeInit() {
  const preference = useThemeStore((state) => state.preference);

  useEffect(() => {
    applyTheme(resolveTheme(preference));

    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme(preference));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return null;
}
