"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "quizcast-theme";
const THEMES = ["light", "dark", "system"];

const ThemeContext = createContext(null);

/**
 * Inline boot script: stamps <html data-theme> before the first paint so a
 * dark-mode user never sees a white flash. Kept in sync with resolveTheme().
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark"&&t!=="system"){t="system"}var d=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d;}catch(e){}})();`;

function systemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return "system";
}

/**
 * ThemeProvider — light / dark / follow-the-OS, persisted per browser.
 * Exposes { theme, resolvedTheme, setTheme, toggleTheme }. The resolved value
 * is written to <html data-theme>, which drives both the CSS custom
 * properties in tokens.css and Tailwind's `dark:` variant.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolved, setResolved] = useState("light");

  // Adopt whatever the boot script already applied.
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolved(stored === "system" ? systemTheme() : stored);
  }, []);

  // Follow the OS while the user stays on "system".
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    setResolved(next === "system" ? systemTheme() : next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme: resolved, setTheme, toggleTheme }),
    [theme, resolved, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the theme context: { theme, resolvedTheme, setTheme, toggleTheme }. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export default ThemeProvider;
