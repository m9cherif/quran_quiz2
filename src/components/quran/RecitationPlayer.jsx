"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { pageImageUrl, regionStyle } from "@/lib/quran/pages";
import {
  audioUrl,
  loadTimeline,
  partOfWord,
  timelineParts,
  timeOfWord,
  wordAt,
} from "@/lib/quran/recitation";
import { readBookmark, saveBookmark } from "@/lib/quran/progress";
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
export default function RecitationPlayer({ page, words = [], className = "", onFinished }) {
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
  const [activeAyah, setActiveAyah] = useState(null);
  const [resumeAt, setResumeAt] = useState(null);
  /** How many times a chosen ayah repeats before stopping — the drill. */
  const [repeats, setRepeats] = useState(1);
  const [repeatsLeft, setRepeatsLeft] = useState(0);
  const repeatDoneRef = useRef(0);
  const pendingSeekRef = useRef(null);
  /**
   * Which recording is playing. Almost every page has one, but a page that
   * straddles two surahs has two, and "play the page" has to run through both.
   */
  const [partIndex, setPartIndex] = useState(0);
  const parts = useMemo(() => (timeline ? timelineParts(timeline) : []), [timeline]);
  const part = parts[partIndex] ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTimeline(null);
    setCurrentWord(null);
    setPartIndex(0);
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
    if (!playing || !part) return;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const ms = el.currentTime * 1000;
        setCurrentWord(wordAt(part, ms));

        // A selected ayah owns the transport until its repeats are spent.
        if (activeAyah && ms >= activeAyah.to) {
          const done = repeatDoneRef.current + 1;
          if (loop || done < repeats) {
            repeatDoneRef.current = done;
            setRepeatsLeft(Math.max(0, repeats - done));
            el.currentTime = activeAyah.from / 1000;
          } else {
            el.pause();
            setActiveAyah(null);
            repeatDoneRef.current = 0;
          }
        } else if (!activeAyah && part.duration > 0) {
          const endMs = part.start + part.duration;
          if (ms >= endMs) {
            if (partIndex + 1 < parts.length) {
              // The page continues in the next surah's recording.
              setPartIndex(partIndex + 1);
            } else if (loop) {
              setPartIndex(0);
              el.currentTime = parts[0].start / 1000;
            } else {
              el.pause();
              // Playlist mode: hand over to the next page.
              onFinished?.();
            }
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, part, partIndex, parts, loop]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Changing recording swaps the <audio> source, which resets the clock: seek
  // to where this stretch begins (or to the word that was asked for) and carry
  // on playing if it was playing.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !part) return;
    const target = pendingSeekRef.current ?? part.start;
    pendingSeekRef.current = null;
    const seek = () => {
      el.currentTime = target / 1000;
      if (playing) el.play().catch(() => setFailed(true));
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener("loadedmetadata", seek, { once: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partIndex, part?.audio]);

  // Remember where this page was left, and offer to resume next visit.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const el = audioRef.current;
      if (el) saveBookmark(page, el.currentTime);
    }, 5000);
    return () => clearInterval(id);
  }, [playing, page]);

  useEffect(() => {
    const mark = readBookmark();
    setResumeAt(mark && mark.page === page && mark.seconds > 5 ? mark.seconds : null);
  }, [page, timeline]);

  const byId = useMemo(() => {
    const map = new Map();
    for (const word of words) if (word.id != null) map.set(word.id, word);
    return map;
  }, [words]);

  /**
   * Ayah ranges in audio time. Looping a single ayah is the drill that
   * actually builds memorisation — a whole page is too long to repeat.
   */
  const ayahs = useMemo(() => {
    if (!part) return [];
    const inPart = new Set(part.events.map((e) => e.w));
    const groups = new Map();
    for (const word of words) {
      if (!word.aya || word.id == null || !inPart.has(word.id)) continue;
      const at = part.start + part.events.find((e) => e.w === word.id).t;
      const found = groups.get(word.aya) ?? { aya: word.aya, from: at, to: at };
      found.from = Math.min(found.from, at);
      found.to = Math.max(found.to, at);
      groups.set(word.aya, found);
    }
    const list = [...groups.values()].sort((a, b) => a.from - b.from);
    // An ayah ends where the next begins; the last runs to the recording end.
    return list.map((item, i) => ({
      ...item,
      to: i + 1 < list.length ? list[i + 1].from : part.start + part.duration,
    }));
  }, [words, part]);

  const playAyah = (ayah) => {
    const el = audioRef.current;
    if (!el) return;
    repeatDoneRef.current = 0;
    setRepeatsLeft(Math.max(0, repeats - 1));
    setActiveAyah(ayah);
    el.currentTime = ayah.from / 1000;
    el.play().catch(() => setFailed(true));
  };

  const seekToWord = (word) => {
    if (!timeline || word.id == null) return;
    const ms = timeOfWord(timeline, word.id);
    if (ms == null) return;
    const el = audioRef.current;
    if (!el) return;
    // The word may live in the page's other recording; load it first, and let
    // the effect below seek once the browser has the new source.
    const index = parts.findIndex((p) => p === partOfWord(timeline, word.id));
    if (index >= 0 && index !== partIndex) {
      pendingSeekRef.current = ms;
      setPartIndex(index);
    } else {
      el.currentTime = ms / 1000;
    }
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
    if (part && el.currentTime * 1000 < part.start) {
      el.currentTime = part.start / 1000;
    }
    el.play().catch(() => setFailed(true));
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el || !parts.length) return;
    if (partIndex !== 0) {
      pendingSeekRef.current = parts[0].start;
      setPartIndex(0);
    } else {
      el.currentTime = parts[0].start / 1000;
    }
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
        src={part?.audio ? audioUrl(part.audio) : undefined}
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

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 p-0.5">
          <span className="px-1.5 text-xs text-ink-muted">{t("recite.repeats")}</span>
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRepeats(n)}
              aria-pressed={repeats === n}
              className={`press rounded px-2 py-1 text-xs font-semibold transition-colors ${
                repeats === n ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>

        <Badge variant="info">{t("recite.wordCount", { count: timeline.events.length })}</Badge>
        {activeAyah && repeatsLeft > 0 && (
          <Badge variant="warning">{t("recite.repeatsLeft", { count: repeatsLeft })}</Badge>
        )}
      </div>

      {ayahs.length > 0 && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold text-ink-muted">{t("recite.ayahs")}</span>
          {activeAyah && (
            <button
              type="button"
              onClick={() => setActiveAyah(null)}
              className="press shrink-0 rounded-md border border-border px-2 py-1 text-xs text-ink-muted"
            >
              {t("recite.wholePage")}
            </button>
          )}
          {ayahs.map((ayah) => (
            <button
              key={ayah.aya}
              type="button"
              onClick={() => playAyah(ayah)}
              aria-pressed={activeAyah?.aya === ayah.aya}
              className={`press shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeAyah?.aya === ayah.aya
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-ink-muted hover:text-ink"
              }`}
            >
              {ayah.aya}
            </button>
          ))}
        </div>
      )}

      {resumeAt !== null && !playing && (
        <button
          type="button"
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            el.currentTime = resumeAt;
            setResumeAt(null);
            el.play().catch(() => setFailed(true));
          }}
          className="press w-full rounded-md border border-primary bg-primary-soft px-4 py-2 text-sm font-medium text-primary"
        >
          {t("recite.resume", {
            time: `${Math.floor(resumeAt / 60)}:${String(Math.floor(resumeAt % 60)).padStart(2, "0")}`,
          })}
        </button>
      )}

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
