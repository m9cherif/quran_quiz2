"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AVAILABLE_PAGES, loadPageAnnotations, pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { audioUrl, loadTimeline } from "@/lib/quran/recitation";

const SPEEDS = [0.5, 0.75, 1];

/**
 * TimelineBuilder — author a page's recitation timeline by tapping along.
 *
 * A timeline is nothing more than "which millisecond does each word start", and
 * no amount of cleverness beats an ear: play the recording and press space the
 * instant the reciter reaches the next word. That is how the upstream files
 * were made, and it is why they can be repaired the same way.
 *
 * The output is written in annotation ids — the ids the page boxes use — so
 * what leaves here needs no translation. (The upstream files number words by
 * their rank on the page instead, which is what put every page a few words out
 * of step until the importer started converting.)
 */
export default function TimelineBuilder() {
  const audioRef = useRef(null);
  const frameRef = useRef(0);

  const [page, setPage] = useState(AVAILABLE_PAGES[0]);
  const [file, setFile] = useState("");
  const [words, setWords] = useState([]);
  const [events, setEvents] = useState([]);
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(0.75);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [status, setStatus] = useState("");

  // Words worth marking: those with an id and actual text (ayah marks have
  // neither and are never recited).
  const markable = useMemo(
    () => words.filter((w) => w.id != null && w.text?.trim()),
    [words]
  );
  const cursor = events.length;
  const currentWord = markable[cursor] ?? null;

  useEffect(() => {
    let active = true;
    setEvents([]);
    setStatus("");
    loadPageAnnotations(page).then((list) => active && setWords(list));
    // Pre-fill the audio file and offsets from an existing timeline, if any.
    loadTimeline(page).then((tl) => {
      if (!active || !tl) return;
      setFile(tl.audio ?? "");
      setStart(tl.start ?? 0);
      setDuration(tl.duration ?? 0);
    });
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, playing]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      if (audioRef.current) setNow(audioRef.current.currentTime * 1000);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing]);

  const mark = useCallback(() => {
    const el = audioRef.current;
    if (!el || !markable[events.length]) return;
    const t = Math.max(0, Math.round(el.currentTime * 1000 - start));
    setEvents((prev) => [...prev, { t, w: markable[prev.length].id }]);
  }, [markable, events.length, start]);

  const undo = useCallback(() => setEvents((prev) => prev.slice(0, -1)), []);

  const nudge = useCallback((ms) => {
    setEvents((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, t: Math.max(0, last.t + ms) };
      return copy;
    });
  }, []);

  // Space marks, Backspace undoes, arrows nudge the last mark. Hands stay on
  // the keyboard: the whole job is one key pressed a hundred times in rhythm.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        mark();
      } else if (e.code === "Backspace") {
        e.preventDefault();
        undo();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        nudge(-50);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        nudge(50);
      } else if (e.code === "KeyP") {
        e.preventDefault();
        const el = audioRef.current;
        if (el) (el.paused ? el.play() : el.pause());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark, undo, nudge]);

  const problems = useMemo(() => {
    const list = [];
    const outOfOrder = events.filter((e, i) => i > 0 && e.t < events[i - 1].t).length;
    if (outOfOrder) list.push(`${outOfOrder} mark(s) earlier than the one before`);
    if (events.length < markable.length) {
      list.push(`${markable.length - events.length} word(s) still unmarked`);
    }
    if (!file.trim()) list.push("no audio file name");
    return list;
  }, [events, markable.length, file]);

  const json = useMemo(
    () =>
      JSON.stringify({
        page,
        audio: file.trim() || null,
        start: Math.round(start) || 0,
        duration: Math.round(duration) || 0,
        events,
      }),
    [page, file, start, duration, events]
  );

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${page}.json — put it in public/timeline/ (see scripts/import-timeline.mjs).`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Timeline builder</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Play the recitation and press <kbd className="rounded border border-border px-1">Space</kbd>{" "}
          the moment each word begins. <kbd className="rounded border border-border px-1">P</kbd>{" "}
          play/pause · <kbd className="rounded border border-border px-1">Backspace</kbd> undo ·{" "}
          <kbd className="rounded border border-border px-1">←</kbd>/
          <kbd className="rounded border border-border px-1">→</kbd> nudge the last mark by 50 ms.
        </p>
      </div>

      <Card padding="lg">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Page</span>
            <select
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            >
              {AVAILABLE_PAGES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Audio file</span>
            <input
              value={file}
              onChange={(e) => setFile(e.target.value)}
              placeholder="062.mp3"
              className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Page starts at (ms)</span>
            <input
              type="number"
              value={start}
              onChange={(e) => setStart(Number(e.target.value) || 0)}
              className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            />
          </label>

          <div className="flex gap-1">
            {SPEEDS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setSpeed(rate)}
                aria-pressed={speed === rate}
                className={`press rounded px-2 py-1.5 text-xs font-semibold ${
                  speed === rate ? "bg-primary text-primary-contrast" : "text-ink-muted hover:text-ink"
                }`}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>

        {file.trim() && (
          <audio
            ref={audioRef}
            src={audioUrl(file.trim())}
            controls
            preload="metadata"
            className="mt-3 w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              const ms = Math.round(e.currentTarget.duration * 1000);
              if (Number.isFinite(ms) && !duration) setDuration(ms);
            }}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={mark} disabled={!currentWord} icon="check">
            Mark word ({cursor + 1}/{markable.length})
          </Button>
          <Button variant="outline" onClick={undo} disabled={events.length === 0} icon="close">
            Undo
          </Button>
          <Button variant="ghost" onClick={() => nudge(-50)} disabled={events.length === 0}>
            −50 ms
          </Button>
          <Button variant="ghost" onClick={() => nudge(50)} disabled={events.length === 0}>
            +50 ms
          </Button>
          <Button variant="outline" onClick={download} disabled={events.length === 0} icon="download">
            Download {page}.json
          </Button>
          <Badge variant="neutral">{Math.round(now)} ms</Badge>
        </div>

        {/* What to say next, large enough to read while listening. */}
        <div dir="rtl" className="mt-4 rounded-md border border-border bg-surface-2 p-4 text-center">
          <p className="text-3xl font-semibold text-primary">{currentWord?.text ?? "—"}</p>
          <p className="mt-2 text-lg text-ink-muted">
            {markable.slice(cursor + 1, cursor + 6).map((w) => w.text).join(" ")}
          </p>
        </div>

        {problems.length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 ps-5 text-xs text-warning-strong">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {status && <p className="mt-3 text-xs text-success-strong">{status}</p>}
      </Card>

      <Card padding="lg">
        <PagePreview page={page} words={markable} marked={cursor} />
      </Card>
    </div>
  );
}

/** The page with words already marked filled in, and the next one outlined. */
function PagePreview({ page, words, marked }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pageImageUrl(page)}
        alt=""
        className="block w-full"
        draggable={false}
        onLoad={(e) =>
          setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
        }
      />
      {size.width > 0 &&
        words.map((word, i) => (
          <span
            key={word.id}
            className={`absolute rounded ${
              i < marked
                ? "bg-success/25"
                : i === marked
                  ? "bg-amber-400/40 ring-2 ring-amber-500"
                  : ""
            }`}
            style={regionStyle({
              x1: word.x1 / size.width,
              y1: word.y1 / size.height,
              x2: word.x2 / size.width,
              y2: word.y2 / size.height,
            })}
          />
        ))}
    </div>
  );
}
