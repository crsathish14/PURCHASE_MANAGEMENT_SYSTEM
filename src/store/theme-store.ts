import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

type PersistedTheme = { preference: ThemePreference };

// Stores just the raw preference string under `theme` in localStorage
// (instead of Zustand's default {state,version} JSON envelope) so the
// FOUC-prevention inline script in layout.tsx can read it with a plain
// localStorage.getItem("theme") call.
const rawStringStorage: PersistStorage<PersistedTheme> = {
  getItem: (name) => {
    const value = localStorage.getItem(name);
    return value ? { state: { preference: value as ThemePreference } } : null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value.state.preference);
  },
  removeItem: (name) => localStorage.removeItem(name),
};

type ThemeState = PersistedTheme & {
  setPreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
    }),
    { name: STORAGE_KEY, storage: rawStringStorage },
  ),
);
