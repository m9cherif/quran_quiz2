"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, timeOfWord, wordAt } from "@/lib/quran/recitation";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SPEEDS = [0.75, 1, 1.25, 1.5];

/**
 * RecitationPlayer — the page with its recitation, word by word.
 *
 * The timeline says which word is reached at which millisecond, so the current
 * word is boxed as it is recited. Tapping any word seeks the audio there,
 * which is what makes this usable for memorising a passage rather than just
 * listening to it: pick the line you keep losing and play from exactly there.
 *
 * "Hide words" covers the page and reveals each word only once it has been
 * recited — a self-test that does not need a teacher present.
 */
export default function RecitationPlayer({ page, words = [], className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const frameRef = useRef(0);

  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [hideWords, setHideWords] = useState(false);
  const [loop, setLoop] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTimeline(null);
    setCurrentWord(null);
    loadTimeline(page)
      .then((data) => {
        if (!active) return;
        setTimeline(data);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page]);

  // Follow playback on animation frames: `timeupdate` only fires ~4×/second,
  // which is visibly late for word-level highlighting.
  useEffect(() => {
    if (!playing || !timeline) return;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const ms = el.currentTime * 1000;
        setCurrentWord(wordAt(timeline, ms));
        const endMs = timeline.start + timeline.duration;
        if (timeline.duration > 0 && ms >= endMs) {
          if (loop) {
            el.currentTime = timeline.start / 1000;
          } else {
            el.pause();
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, timeline, loop]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const byId = useMemo(() => {
    const map = new Map();
    for (const word of words) if (word.id != null) map.set(word.id, word);
    return map;
  }, [words]);

  const seekToWord = (word) => {
    if (!timeline || word.id == null) return;
    const ms = timeOfWord(timeline, word.id);
    if (ms == null) return;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    setCurrentWord(word.id);
    if (!playing) el.play().catch(() => setFailed(true));
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    // Start at the page's own offset: several pages share one surah recording.
    if (timeline && el.currentTime * 1000 < timeline.start) {
      el.currentTime = timeline.start / 1000;
    }
    el.play().catch(() => setFailed(true));
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el || !timeline) return;
    el.currentTime = timeline.start / 1000;
    setCurrentWord(null);
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-2" />;
  }

  if (!timeline?.audio) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("recite.none")}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <audio
        ref={audioRef}
        src={audioUrl(timeline.audio)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={toggle} icon={playing ? "pause" : "play"}>
          {playing ? t("recite.pause") : t("recite.play")}
        </Button>
        <Button variant="ghost" onClick={restart} icon="refresh">
          {t("recite.restart")}
        </Button>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 p-0.5">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setSpeed(rate)}
              aria-pressed={speed === rate}
              className={`press rounded px-2 py-1 text-xs font-semibold transition-colors ${
                speed === rate ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {t("recite.loop")}
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={hideWords}
            onChange={(e) => setHideWords(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {t("recite.hide")}
        </label>

        <Badge variant="info">{t("recite.wordCount", { count: timeline.events.length })}</Badge>
      </div>

      {failed && (
        <p className="text-sm text-danger" role="alert">
          {t("recite.failed")}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageImageUrl(page)}
          alt=""
          className="block w-full"
          draggable={false}
          // Boxes are stored in the workbook's pixel space; they only become
          // percentages once the real image size is known.
          onLoad={(e) =>
            setImageSize({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
        />

        {imageSize.width > 0 && words.map((word, i) => {
          const isCurrent = word.id != null && word.id === currentWord;
          // In hide mode a word stays covered until the reciter reaches it.
          const spoken =
            !hideWords ||
            (currentWord != null && word.id != null && word.id <= currentWord);

          return (
            <button
              key={word.id ?? `w-${i}`}
              type="button"
              onClick={() => seekToWord(word)}
              aria-label={word.text}
              className={`absolute rounded transition-all duration-150 ${
                isCurrent
                  ? "bg-primary/30 ring-2 ring-primary"
                  : spoken
                    ? "hover:bg-primary/10"
                    : "bg-white"
              }`}
              style={regionStyle({
                x1: word.x1 / imageSize.width,
                y1: word.y1 / imageSize.height,
                x2: word.x2 / imageSize.width,
                y2: word.y2 / imageSize.height,
              })}
            />
          );
        })}
      </div>

      <p className="text-xs text-ink-muted">{t("recite.tapHint")}</p>
    </div>
  );
}
