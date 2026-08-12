"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";

const SUN = (
  <path d="M10 2.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 10 2.5Zm0 3.25a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM3.6 4.66a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.07l-.7-.71a.75.75 0 0 1 0-1.06Zm11.74 0a.75.75 0 0 1 0 1.06l-.7.71a.75.75 0 1 1-1.07-1.07l.71-.7a.75.75 0 0 1 1.06 0ZM2.5 10a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2.5 10Zm12.25 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM4.66 16.4a.75.75 0 0 1 0-1.06l.7-.7a.75.75 0 0 1 1.07 1.06l-.71.7a.75.75 0 0 1-1.06 0Zm9.62-1.76a.75.75 0 0 1 1.06 0l.71.7a.75.75 0 1 1-1.06 1.06l-.71-.7a.75.75 0 0 1 0-1.06ZM10 15.75a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75Z" />
);

const MOON = (
  <path d="M8.28 2.62a.75.75 0 0 1 .2.86 6 6 0 0 0 8.04 8.04.75.75 0 0 1 1 1A7.5 7.5 0 1 1 7.42 2.42a.75.75 0 0 1 .86.2Z" />
);

/**
 * ThemeToggle — one-tap light/dark switch.
 * Long label is reserved for screen readers; the icon shows the theme the
 * button switches *to*, which is what users expect from a toggle.
 */
export function ThemeToggle({ className }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const goingDark = resolvedTheme !== "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={goingDark ? t("theme.switchToDark") : t("theme.switchToLight")}
      title={goingDark ? t("theme.switchToDark") : t("theme.switchToLight")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-ink-muted transition-colors hover:text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring",
        className
      )}
    >
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        {goingDark ? MOON : SUN}
      </svg>
    </button>
  );
}

export default ThemeToggle;
