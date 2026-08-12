"use client";

import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** A short, deliberately neutral set — no faces to argue over. */
export const AVATARS = ["🦊", "🐼", "🦉", "🐝", "🌙", "⭐", "🌿", "🕌", "📗", "🚀", "🐬", "🦁"];

/**
 * AvatarPicker — a student picks a symbol so the leaderboard is readable at a
 * glance instead of being a wall of names.
 */
export default function AvatarPicker({ value, onChange, className }) {
  const { t } = useI18n();

  return (
    <div className={className}>
      <p className="mb-1.5 text-sm font-medium text-ink">{t("avatar.label")}</p>
      <div role="group" aria-label={t("avatar.label")} className="flex flex-wrap gap-1.5">
        {AVATARS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(value === emoji ? "" : emoji)}
            aria-pressed={value === emoji}
            className={cn(
              "press h-10 w-10 rounded-lg border text-xl transition-colors",
              value === emoji
                ? "border-primary bg-primary-soft"
                : "border-border bg-surface hover:border-primary"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
