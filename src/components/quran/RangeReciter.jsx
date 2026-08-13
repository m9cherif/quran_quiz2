"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, wordSpans } from "@/lib/quran/recitation";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SPEEDS = [0.5, 0.65, 0.8, 1];
const REPEATS = [1, 3, 5, 10];
const GAPS = [0, 1, 2, 3];

/**
 * RangeReciter — pick a first word and a last word, then hear exactly that,
 * recited attentively.
 *
 * "Attentively" is the point of the mode: slow speeds down to half, a pause
 * between repeats so the learner can say it back, an optional pause after
 * every single word, and the current word boxed on the page throughout. It is
 * for working a difficult half-line until it sticks, not for listening to a
 * page.
 *
 * The range is exact because a word ends where the next one begins, so the
 * bounds come straight from the timeline.
 */
export default function RangeReciter({ page, words = [], className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const frameRef = useRef(0);
  const resumeRef = useRef(null);
  const repeatsDoneRef = useRef(0);

  const [timeline, setTimeline] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [startId, setStartId] = useState(null);
  const [endId, setEndId] = useState(null);
  const [speed, setSpeed] = useState(0.8);
  const [repeats, setRepeats] = useState(3);
  const [gap, setGap] = useState(1);
  const [wordByWord, setWordByWord] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let active = true;
    setTimeline(null);
    setStartId(null);
    setEndId(null);
    loadTimeline(page).then((data) => active && setTimeline(data));
    return () => {
      active = false;
      clearTimeout(resumeRef.current);
    };
  }, [page]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, playing]);

  const spans = useMemo(() => (timeline ? wordSpans(timeline) : []), [timeline]);
  const hasSpan = useMemo(() => new Set(spans.map((s) => s.w)), [spans]);

  /** Words that exist on the page and in the recording, in reading order. */
  const usable = useMemo(
    () => words.filter((w) => w.id != null && hasSpan.has(w.id)),
    [words, hasSpan]
  );

  // The selection, normalised so tapping in either order works.
  const range = useMemo(() => {
    if (startId == null || endId == null) return null;
    const a = usable.findIndex((w) => w.id === startId);
    const b = usable.findIndex((w) => w.id === endId);
    if (a < 0 || b < 0) return null;
    const [from, to] = a <= b ? [a, b] : [b, a];
    const slice = usable.slice(from, to + 1);

    // A reciter who repeats a phrase gives a word several spans, so take the
    // first time the opening word is said and the first time the closing word
    // is said after it — never a pair that runs backwards.
    const startIdx = spans.findIndex((s) => s.w === slice[0].id);
    const lastId = slice[slice.length - 1].id;
    let endIdx = spans.findIndex((s, i) => i >= startIdx && s.w === lastId);
    if (endIdx < 0) endIdx = spans.map((s) => s.w).lastIndexOf(lastId);
    if (startIdx < 0 || endIdx < 0) return null;

    return {
      words: slice,
      ids: new Set(slice.map((w) => w.id)),
      from: spans[startIdx].from,
      to: Math.max(spans[endIdx].to, spans[startIdx].to),
      text: slice.map((w) => w.text).join(" "),
    };
  }, [startId, endId, usable, spans]);

  const stop = useCallback(() => {
    clearTimeout(resumeRef.current);
    cancelAnimationFrame(frameRef.current);
    audioRef.current?.pause();
    setPlaying(false);
    setCurrentWord(null);
    repeatsDoneRef.current = 0;
    setRound(0);
  }, []);

  const startAt = useCallback((ms) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    el.playbackRate = speed;
    el.play().catch(() => {});
  }, [speed]);

  const play = () => {
    if (!range) return;
    repeatsDoneRef.current = 0;
    setRound(1);
    startAt(range.from);
  };

  // Drive the range: stop at its end, pause between repeats, and — in
  // word-by-word mode — pause after each word.
  useEffect(() => {
    if (!playing || !range) return;

    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const ms = el.currentTime * 1000;
        const span = spans.find((s) => ms >= s.from && ms < s.to);
        setCurrentWord(span && range.ids.has(span.w) ? span.w : null);

        // Pause a moment after each word, then pick up at the next one.
        if (wordByWord && span && ms >= span.to - 40 && span.to < range.to) {
          el.pause();
          clearTimeout(resumeRef.current);
          resumeRef.current = setTimeout(() => startAt(span.to), Math.max(250, gap * 700));
          return;
        }

        if (ms >= range.to) {
          el.pause();
          const done = repeatsDoneRef.current + 1;
          repeatsDoneRef.current = done;
          if (done < repeats) {
            setRound(done + 1);
            clearTimeout(resumeRef.current);
            resumeRef.current = setTimeout(() => startAt(range.from), gap * 1000);
          } else {
            setCurrentWord(null);
            setRound(0);
          }
          return;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, range, spans, repeats, gap, wordByWord, startAt]);

  const tapWord = (word) => {
    if (word.id == null || !hasSpan.has(word.id)) return;
    // First tap sets the start; second closes the range; third starts over.
    if (startId == null || (startId != null && endId != null)) {
      setStartId(word.id);
      setEndId(null);
      stop();
    } else {
      setEndId(word.id);
    }
  };

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
      />

      <p className="text-sm text-ink-muted">
        {startId == null
          ? t("range.tapStart")
          : endId == null
            ? t("range.tapEnd")
            : t("range.selected", { count: range?.words.length ?? 0 })}
      </p>

      {range && (
        <p dir="rtl" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-lg text-ink">
          {range.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={playing ? stop : play} disabled={!range} icon={playing ? "pause" : "play"}>
          {playing ? t("range.stop") : t("range.play")}
        </Button>
        <Button
          variant="ghost"
          icon="close"
          onClick={() => {
            setStartId(null);
            setEndId(null);
            stop();
          }}
          disabled={startId == null}
        >
          {t("range.clear")}
        </Button>
        {round > 0 && <Badge variant="info">{t("range.round", { n: round, total: repeats })}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-2">
        <span className="text-xs font-semibold text-ink-muted">{t("range.speed")}</span>
        <div className="flex gap-1">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setSpeed(rate)}
              aria-pressed={speed === rate}
              className={`press rounded px-2 py-1 text-xs font-semibold ${
                speed === rate ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-ink-muted">{t("recite.repeats")}</span>
        <div className="flex gap-1">
          {REPEATS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRepeats(n)}
              aria-pressed={repeats === n}
              className={`press rounded px-2 py-1 text-xs font-semibold ${
                repeats === n ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-ink-muted">{t("range.gap")}</span>
        <div className="flex gap-1">
          {GAPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGap(n)}
              aria-pressed={gap === n}
              className={`press rounded px-2 py-1 text-xs font-semibold ${
                gap === n ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
              }`}
            >
              {n}s
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={wordByWord}
            onChange={(e) => setWordByWord(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {t("range.wordByWord")}
        </label>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageImageUrl(page)}
          alt=""
          className="block w-full"
          draggable={false}
          onLoad={(e) =>
            setImageSize({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
        />
        {imageSize.width > 0 &&
          usable.map((word) => {
            const inRange = range?.ids.has(word.id);
            const isEdge = word.id === startId || word.id === endId;
            const isCurrent = word.id === currentWord;
            return (
              <button
                key={word.id}
                type="button"
                onClick={() => tapWord(word)}
                aria-label={word.text}
                className={`absolute rounded transition-colors ${
                  isCurrent
                    ? "bg-primary/40 ring-2 ring-primary"
                    : isEdge
                      ? "bg-amber-400/40 ring-2 ring-amber-500"
                      : inRange
                        ? "bg-primary/15"
                        : "hover:bg-primary/10"
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
    </div>
  );
}
