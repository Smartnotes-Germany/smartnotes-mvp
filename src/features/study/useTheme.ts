import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "./constants";
import type { ThemePreference } from "./types";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "system";
  });

  const applyTheme = useCallback((pref: ThemePreference) => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldBeDark = pref === "dark" || (pref === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  useEffect(() => {
    applyTheme(preference);
    localStorage.setItem(STORAGE_KEYS.theme, preference);
  }, [preference, applyTheme]);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [preference, applyTheme]);

  return { preference, setPreference } as const;
}
