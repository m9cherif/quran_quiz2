"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { loadPageAnnotations, pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, loadTimelineIndex, wordSpans } from "@/lib/quran/recitation";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * AudioRangePicker — build an audio question's clip by tapping two words.
 *
 * An audio question is a recitation with a start and an end, which is exactly
 * what the practice range player already plays. Typing a media-fragment URL by
 * hand is not something anyone should be asked to do, so the host picks the
 * passage the way a student would: tap the first word, tap the last.
 *
 * What it produces is an ordinary "#t=start,end" URL — the same thing generated
 * questions use and the same thing the player already understands — so nothing
 * downstream needs to know this screen exists.
 */
export default function AudioRangePicker({ onPick }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const stopAtRef = useRef(null);
  const frameRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(null);
  const [words, setWords] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [startId, setStartId] = useState(null);
  const [endId, setEndId] = useState(null);

  useEffect(() => {
    if (!open) return;
    loadTimelineIndex().then((index) => {
      const available = Object.keys(index).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      setPages(available);
      setPage((current) => current ?? available[0] ?? null);
    });
  }, [open]);

  useEffect(() => {
    if (page == null) return;
    let active = true;
    setStartId(null);
    setEndId(null);
    loadPageAnnotations(page).then((list) => active && setWords(list));
    loadTimeline(page).then((data) => active && setTimeline(data));
    return () => {
      active = false;
    };
  }, [page]);

  const spans = useMemo(() => (timeline ? wordSpans(timeline) : []), [timeline]);
  const hasSpan = useMemo(() => new Set(spans.map((s) => s.w)), [spans]);
  const usable = useMemo(
    () => words.filter((w) => w.id != null && hasSpan.has(w.id)),
    [words, hasSpan]
  );

  const range = useMemo(() => {
    if (startId == null || endId == null) return null;
    const a = usable.findIndex((w) => w.id === startId);
    const b = usable.findIndex((w) => w.id === endId);
    if (a < 0 || b < 0) return null;
    const [from, to] = a <= b ? [a, b] : [b, a];
    const slice = usable.slice(from, to + 1);
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
      last: slice[slice.length - 1].text,
    };
  }, [startId, endId, usable, spans]);

  // Media fragments are a request to the browser, not a promise: it may hand
  // back the whole file, so the end is enforced here as well.
  const preview = () => {
    const el = audioRef.current;
    if (!el || !range) return;
    stopAtRef.current = range.to;
    el.currentTime = range.from / 1000;
    el.play().catch(() => {});
    cancelAnimationFrame(frameRef.current);
    const tick = () => {
      if (el.currentTime * 1000 >= stopAtRef.current) {
        el.pause();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const confirm = () => {
    if (!range || !timeline?.audio) return;
    onPick({
      audioUrl: `${audioUrl(timeline.audio)}#t=${(range.from / 1000).toFixed(2)},${(range.to / 1000).toFixed(2)}`,
      passage: range.text,
      lastWord: range.last,
      page,
    });
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" icon="play" onClick={() => setOpen(true)}>
        {t("audioQ.fromQuran")}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-muted">{t("pw.pageLabel")}</span>
        <select
          value={page ?? ""}
          onChange={(e) => setPage(Number(e.target.value))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
        >
          {pages.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" icon="close" onClick={() => setOpen(false)}>
          {t("common.close")}
        </Button>
      </div>

      <p className="text-xs text-ink-muted">
        {startId == null
          ? t("range.tapStart")
          : endId == null
            ? t("range.tapEnd")
            : t("range.selected", { count: range?.words.length ?? 0 })}
      </p>

      {range && (
        <p dir="rtl" className="rounded-md border border-border bg-surface px-3 py-2 text-lg text-ink">
          {range.text}
        </p>
      )}

      {timeline?.audio && <audio ref={audioRef} src={audioUrl(timeline.audio)} preload="none" />}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon="play" onClick={preview} disabled={!range}>
          {t("audioQ.preview")}
        </Button>
        <Button size="sm" icon="check" onClick={confirm} disabled={!range}>
          {t("audioQ.useRange")}
        </Button>
      </div>

      <div className="relative max-h-[50vh] overflow-auto rounded-lg border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={page != null ? pageImageUrl(page) : ""}
          alt=""
          className="block w-full"
          draggable={false}
          onLoad={(e) =>
            setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
        />
        {size.width > 0 &&
          usable.map((word) => {
            const inRange = range?.ids.has(word.id);
            const isEdge = word.id === startId || word.id === endId;
            return (
              <button
                key={word.id}
                type="button"
                aria-label={word.text}
                onClick={() => {
                  if (startId == null || (startId != null && endId != null)) {
                    setStartId(word.id);
                    setEndId(null);
                  } else {
                    setEndId(word.id);
                  }
                }}
                className={`absolute rounded ${
                  isEdge
                    ? "bg-amber-400/40 ring-2 ring-amber-500"
                    : inRange
                      ? "bg-primary/15"
                      : "hover:bg-primary/10"
                }`}
                style={regionStyle({
                  x1: word.x1 / size.width,
                  y1: word.y1 / size.height,
                  x2: word.x2 / size.width,
                  y2: word.y2 / size.height,
                })}
              />
            );
          })}
      </div>
    </div>
  );
}
