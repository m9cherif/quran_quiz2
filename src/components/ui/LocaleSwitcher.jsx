"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "en", label: "EN", title: "English" },
  { value: "ar", label: "ع", title: "العربية" },
  { value: "fr", label: "FR", title: "Français" },
];

/**
 * LocaleSwitcher — compact segmented control for en / ar / fr.
 * Persists the choice via useI18n (localStorage + html lang/dir).
 */
export function LocaleSwitcher({ className }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn("inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5", className)}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          aria-pressed={locale === opt.value}
          onClick={() => setLocale(opt.value)}
          className={cn(
            "h-7 rounded px-2 text-xs font-semibold transition-colors",
            locale === opt.value ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default LocaleSwitcher;