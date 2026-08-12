"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  defaultLocale,
  defaultMessages,
  loadMessages,
  peekMessages,
} from "./dictionaries";

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
  return defaultLocale;
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
 * I18nProvider — locale context (en / ar / fr).
 * Persists the choice to localStorage, sets <html lang|dir>, and exposes
 *   { locale, setLocale, t(key, params?), dir }.
 * t() resolves dotted keys ("nav.home") with {name} interpolation.
 *
 * The locale is detected in an effect (not during render) so the first client
 * render matches the server HTML; ar/fr dictionaries are code-split and
 * awaited before the switch is applied, so strings never flash as raw keys.
 */
export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [messages, setMessages] = useState(defaultMessages);

  // Restore the saved/preferred locale once, on the client.
  useEffect(() => {
    const detected = detectLocale();
    if (detected === defaultLocale) return;
    let active = true;
    loadMessages(detected)
      .then((dict) => {
        if (!active) return;
        setMessages(dict);
        setLocaleState(detected);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore storage failures
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (next === defaultLocale) {
      setMessages(defaultMessages);
      setLocaleState(next);
      return;
    }
    // Show the new locale only once its chunk is in memory.
    setMessages(peekMessages(next));
    loadMessages(next)
      .then((dict) => {
        setMessages(dict);
        setLocaleState(next);
      })
      .catch(() => {});
  }, []);

  const t = useCallback(
    (key, params) => {
      let value = resolvePath(messages, key);
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          value = value.replace(`{${name}}`, String(val));
        }
      }
      return value;
    },
    [messages]
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
