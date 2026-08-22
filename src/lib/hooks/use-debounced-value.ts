"use client";

import { useEffect, useState } from "react";

// No debounce utility existed anywhere in the repo before the PR search box
// needed one (1s idle after the last keystroke before firing a fetch).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
