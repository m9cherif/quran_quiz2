"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/I18nProvider";

const STORAGE_KEY = "quizcast-accent";

/**
 * Accent palettes. Each entry overrides only the primary tokens, so every
 * component that already reads them (buttons, badges, timers, charts) follows
 * along without touching a single class name.
 * Values are "R G B" triples to match tokens.css.
 */
export const ACCENTS = {
  indigo: { label: "Indigo", swatch: "#4f46e5", light: ["79 70 229", "67 56 202", "224 231 255"], dark: ["129 140 248", "165 180 252", "49 46 129"] },
  emerald: { label: "Emerald", swatch: "#059669", light: ["5 150 105", "4 120 87", "209 250 229"], dark: ["52 211 153", "110 231 183", "6 78 59"] },
  amber: { label: "Amber", swatch: "#d97706", light: ["217 119 6", "180 83 9", "254 243 199"], dark: ["251 191 36", "252 211 77", "120 53 15"] },
  rose: { label: "Rose", swatch: "#e11d48", light: ["225 29 72", "190 18 60", "255 228 230"], dark: ["251 113 133", "253 164 175", "136 19 55"] },
  sky: { label: "Sky", swatch: "#0284c7", light: ["2 132 199", "3 105 161", "224 242 254"], dark: ["56 189 248", "125 211 252", "12 74 110"] },
  violet: { label: "Violet", swatch: "#7c3aed", light: ["124 58 237", "109 40 217", "237 233 254"], dark: ["167 139 250", "196 181 253", "76 29 149"] },
};

/** Boot script: applies the saved accent before paint, like the theme. */
export const accentBootScript = `(function(){try{var a=localStorage.getItem("${STORAGE_KEY}");if(a)document.documentElement.dataset.accent=a;}catch(e){}})();`;

export function applyAccent(name) {
  if (typeof document === "undefined") return;
  const accent = ACCENTS[name];
  if (!accent) return;
  const isDark = document.documentElement.dataset.theme === "dark";
  const [primary, strong, soft] = isDark ? accent.dark : accent.light;
  const root = document.documentElement.style;
  root.setProperty("--color-primary", primary);
  root.setProperty("--color-primary-strong", strong);
  root.setProperty("--color-primary-soft", soft);
  root.setProperty("--color-focus-ring", primary);
  document.documentElement.dataset.accent = name;
}

/** AccentPicker — six one-tap colour schemes, remembered per device. */
export function AccentPicker({ className }) {
  const { t } = useI18n();
  const [active, setActive] = useState("indigo");

  useEffect(() => {
    let saved = "indigo";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "indigo";
    } catch {
      // ignore
    }
    if (!ACCENTS[saved]) saved = "indigo";
    setActive(saved);
    applyAccent(saved);

    // The palette differs per theme, so re-apply when the theme flips.
    const observer = new MutationObserver(() => applyAccent(saved));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const choose = (name) => {
    setActive(name);
    applyAccent(name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // ignore
    }
  };

  return (
    <div role="group" aria-label={t("accent.aria")} className={cn("flex items-center gap-1.5", className)}>
      {Object.entries(ACCENTS).map(([name, accent]) => (
        <button
          key={name}
          type="button"
          onClick={() => choose(name)}
          aria-pressed={active === name}
          title={accent.label}
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
            active === name ? "border-ink scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: accent.swatch }}
        >
          <span className="sr-only">{accent.label}</span>
        </button>
      ))}
    </div>
  );
}

export default AccentPicker;
