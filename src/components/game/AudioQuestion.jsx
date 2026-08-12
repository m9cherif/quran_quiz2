"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * AudioQuestion — the listening prompt for an `audio` question.
 * Playback is user-initiated (never autoplay: a class of phones all starting
 * at once is chaos), and the replay count is shown so a teacher can see the
 * clip is being used rather than guessed at.
 */
export default function AudioQuestion({ src, disabled = false }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A new question means a new clip: stop whatever was still playing.
    setPlaying(false);
    setPlays(0);
    setFailed(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [src]);

  if (!src) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    el.play()
      .then(() => setPlays((n) => n + 1))
      .catch(() => setFailed(true));
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    if (!playing) toggle();
  };

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      {failed ? (
        <p className="text-sm text-danger" role="alert">
          {t("audioQ.failed")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={toggle} disabled={disabled} size="lg">
            {playing ? t("audioQ.pause") : plays === 0 ? t("audioQ.play") : t("audioQ.playAgain")}
          </Button>
          <Button variant="ghost" onClick={restart} disabled={disabled || plays === 0}>
            {t("audioQ.restart")}
          </Button>
          <span className="text-xs text-ink-muted">
            {plays === 0 ? t("audioQ.notPlayed") : t("audioQ.playCount", { count: plays })}
          </span>
        </div>
      )}
    </div>
  );
}
