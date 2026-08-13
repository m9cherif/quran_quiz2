"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { loadPageAnnotations, pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, loadTimelineIndex, wordSpans } from "@/lib/quran/recitation";
import { hizbOfPage, loadQuranMeta, placeWords } from "@/lib/quran/meta";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** What the student is asked once the passage has been played. */
const ASKS = [
  ["word", "audioQ.askWord"],
  ["surah", "audioQ.askSurah"],
  ["ayah", "audioQ.askAyah"],
  ["hizb", "audioQ.askHizb"],
];

/** Three plausible wrong numbers around the right one, inside its range. */
function nearbyNumbers(correct, min, max, count = 3) {
  const pool = [];
  for (let d = 1; pool.length < count * 3 && d <= 8; d += 1) {
    if (correct - d >= min) pool.push(correct - d);
    if (correct + d <= max) pool.push(correct + d);
  }
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * Math.min(pool.length, 5)), 1)[0]);
  }
  return picked;
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
  const [ask, setAsk] = useState("word");
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (open) loadQuranMeta().then(setMeta);
  }, [open]);

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

  // Where the passage sits: the surah and ayah of its first word, and the hizb
  // quarter of the page.
  const placement = useMemo(() => {
    if (!meta || !range || page == null) return null;
    const placed = placeWords(page, words, meta);
    const first = placed.get(range.words[0].id);
    const hizb = hizbOfPage(page, meta);
    const surah = first ? meta.surahs.find((s) => s.n === first.surah) : null;
    return { first, hizb, surah };
  }, [meta, range, words, page]);

  /** A passage nobody chose — four to ten consecutive words, anywhere. */
  const pickRandom = () => {
    if (usable.length < 4) return;
    const length = 4 + Math.floor(Math.random() * 7);
    const from = Math.floor(Math.random() * Math.max(1, usable.length - length));
    setStartId(usable[from].id);
    setEndId(usable[Math.min(usable.length - 1, from + length - 1)].id);
  };

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

  /**
   * What is asked, and what counts as right.
   *
   * Naming a surah, an ayah or a hizb is multiple choice rather than typing:
   * answers are graded by exact string match, and no student should lose a
   * point for spelling الجُمعَة without its vowels. Giving the last word stays
   * typed — there is only one way to write it, and it is the word they just
   * heard.
   */
  const buildAsk = () => {
    if (ask === "word" || !placement?.first) {
      return { answerText: range.last, choices: null, prompt: t("audioQ.promptWord") };
    }
    if (ask === "surah") {
      const right = placement.first.surahName;
      const others = nearbyNumbers(placement.first.surah, 1, 114)
        .map((n) => meta.surahs.find((s) => s.n === n)?.name)
        .filter((name) => name && name !== right);
      return {
        answerText: right,
        choices: shuffled([right, ...others]),
        prompt: t("audioQ.promptSurah"),
      };
    }
    if (ask === "ayah") {
      const right = placement.first.aya;
      const max = placement.surah?.ayas ?? right + 5;
      return {
        answerText: String(right),
        choices: shuffled([right, ...nearbyNumbers(right, 1, max)].map(String)),
        prompt: t("audioQ.promptAyah"),
      };
    }
    const right = placement.hizb?.hizb;
    if (right == null) return { answerText: range.last, choices: null, prompt: t("audioQ.promptWord") };
    return {
      answerText: String(right),
      choices: shuffled([right, ...nearbyNumbers(right, 1, 60)].map(String)),
      prompt: t("audioQ.promptHizb"),
    };
  };

  const confirm = () => {
    if (!range || !timeline?.audio) return;
    const built = buildAsk();
    onPick({
      audioUrl: `${audioUrl(timeline.audio)}#t=${(range.from / 1000).toFixed(2)},${(range.to / 1000).toFixed(2)}`,
      passage: range.text,
      lastWord: range.last,
      page,
      ask,
      ...built,
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-muted">{t("audioQ.askLabel")}</span>
        {ASKS.map(([id, key]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAsk(id)}
            aria-pressed={ask === id}
            className={`press rounded px-2 py-1 text-xs font-semibold ${
              ask === id ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {/* What the answer will be, so the host sees it before committing. */}
      {range && placement && ask !== "word" && (
        <p className="text-xs text-ink-muted">
          {ask === "surah" && t("audioQ.answerIs", { answer: placement.first?.surahName ?? "—" })}
          {ask === "ayah" && t("audioQ.answerIs", { answer: placement.first?.aya ?? "—" })}
          {ask === "hizb" && t("audioQ.answerIs", { answer: placement.hizb?.hizb ?? "—" })}
        </p>
      )}
      {ask === "hizb" && placement?.hizb?.boundary && (
        <p className="text-xs text-warning-strong">{t("audioQ.hizbBoundary")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon="dice" onClick={pickRandom} disabled={usable.length < 4}>
          {t("audioQ.random")}
        </Button>
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
