"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./dictionaries";

const STORAGE_KEY = "quizcast-locale";

const I18nContext = createContext(null);

function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar" || saved === "fr") return saved;
  } catch {
    // storage unavailable — fall through to navigator detection
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav.toLowerCase().startsWith("ar")) return "ar";
  if (nav.toLowerCase().startsWith("fr")) return "fr";
  return "en";
}

function resolvePath(node, path) {
  for (const segment of path.split(".")) {
    if (node && typeof node === "object" && segment in node) {
      node = node[segment];
    } else {
      return path;
    }
  }
  return typeof node === "string" ? node : path;
}

/**
 * I18nProvider — lightweight locale context (en / ar / fr).
 * Persists the choice to localStorage, sets <html lang|dir>, and exposes
 *   { locale, setLocale, t(key, params?) }.
 * t() resolves dotted keys ("nav.home") with {name} interpolation.
 */
export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() =>
    typeof window === "undefined" ? "en" : detectLocale()
  );

  const apply = useCallback((next) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    apply(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore storage failures
    }
  }, [locale, apply]);

  const setLocale = useCallback((next) => setLocaleState(next), []);

  const t = useCallback(
    (key, params) => {
      let value = resolvePath(messages[locale], key);
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          value = value.replace(`{${name}}`, String(val));
        }
      }
      return value;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, dir: locale === "ar" ? "rtl" : "ltr" }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the i18n context: { locale, setLocale, t, dir }. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}