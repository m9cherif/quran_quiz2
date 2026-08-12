"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { playCue, setSoundEnabled, soundEnabled } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ON = <path d="M10 3.5a.75.75 0 0 0-1.2-.6L5.4 5.5H3.25A1.25 1.25 0 0 0 2 6.75v6.5A1.25 1.25 0 0 0 3.25 14.5H5.4l3.4 2.6a.75.75 0 0 0 1.2-.6v-13Zm3.1 2.6a.75.75 0 0 1 1.05.14 6.5 6.5 0 0 1 0 7.52.75.75 0 1 1-1.2-.9 5 5 0 0 0 0-5.72.75.75 0 0 1 .15-1.05Zm-1.9 2.5a.75.75 0 0 1 1.03.24 3 3 0 0 1 0 3.32.75.75 0 1 1-1.27-.8 1.5 1.5 0 0 0 0-1.72.75.75 0 0 1 .24-1.04Z" />;
const OFF = <path d="M10 3.5a.75.75 0 0 0-1.2-.6L5.4 5.5H3.25A1.25 1.25 0 0 0 2 6.75v6.5A1.25 1.25 0 0 0 3.25 14.5H5.4l3.4 2.6a.75.75 0 0 0 1.2-.6v-13Zm2.72 3.72a.75.75 0 0 1 1.06 0L15 8.44l1.22-1.22a.75.75 0 1 1 1.06 1.06L16.06 9.5l1.22 1.22a.75.75 0 1 1-1.06 1.06L15 10.56l-1.22 1.22a.75.75 0 0 1-1.06-1.06l1.22-1.22-1.22-1.22a.75.75 0 0 1 0-1.06Z" />;

/**
 * SoundToggle — opt-in audio cues (correct, wrong, final seconds).
 * Off by default: a room of phones chiming at once is worse than silence.
 */
export function SoundToggle({ className }) {
  const { t } = useI18n();
  const [on, setOn] = useState(false);

  useEffect(() => setOn(soundEnabled()), []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) playCue("pop"); // confirm audibly that it works
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? t("sound.turnOff") : t("sound.turnOn")}
      title={on ? t("sound.turnOff") : t("sound.turnOn")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 transition-colors hover:text-ink",
        on ? "text-primary" : "text-ink-muted",
        className
      )}
    >
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        {on ? ON : OFF}
      </svg>
    </button>
  );
}

export default SoundToggle;
