"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { pageImageUrl, regionStyle, normaliseArabic } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, timelineParts } from "@/lib/quran/recitation";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * ReciteAndFill — the drill that needs both files at once.
 *
 * The recitation plays and the page follows it, but a handful of words are
 * covered. The timeline says exactly when the reciter arrives at each covered
 * word, so the audio *stops there* and waits for the learner to supply it —
 * out loud in their head, then typed to check. Getting it right resumes the
 * recitation from that same word.
 *
 * Neither file can do this alone: the mp3 gives the voice, the timeline gives
 * the moment to stop.
 */
export default function ReciteAndFill({ page, words = [], gapCount = 6, className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const frameRef = useRef(0);

  const [timeline, setTimeline] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [gaps, setGaps] = useState([]);
  const [solved, setSolved] = useState({});
  const [waitingFor, setWaitingFor] = useState(null);
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    loadTimeline(page).then((data) => active && setTimeline(data));
    return () => {
      active = false;
    };
  }, [page]);

  /** Words that both have a box and a moment in the recording can be gaps. */
  /**
   * The stretch of recording the drill runs in. This one plays continuously and
   * stops at each gap, so it cannot hop between files: a page split over two
   * surahs is drilled on whichever half is longer.
   */
  const part = useMemo(() => {
    if (!timeline) return null;
    return timelineParts(timeline).reduce(
      (best, p) => (!best || p.events.length > best.events.length ? p : best),
      null
    );
  }, [timeline]);

  const candidates = useMemo(() => {
    if (!part) return [];
    const at = new Map(part.events.map((e) => [e.w, part.start + e.t]));
    return words
      .filter((w) => w.id != null && w.text.trim() && at.has(w.id))
      .map((w) => ({ ...w, at: at.get(w.id) }))
      .sort((a, b) => a.at - b.at);
  }, [words, part]);

  const start = () => {
    if (candidates.length === 0) return;
    // Spread the gaps through the page rather than clustering them.
    const step = Math.max(1, Math.floor(candidates.length / (gapCount + 1)));
    const picked = [];
    for (let i = step; i < candidates.length && picked.length < gapCount; i += step) {
      picked.push(candidates[i]);
    }
    setGaps(picked);
    setSolved({});
    setDone(false);
    setWaitingFor(null);
    setTyped("");

    const el = audioRef.current;
    if (el && timeline) {
      el.currentTime = part.start / 1000;
      el.play().catch(() => {});
    }
  };

  // Stop the moment the reciter reaches an unsolved gap.
  useEffect(() => {
    if (!playing || !timeline || gaps.length === 0) return;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const ms = el.currentTime * 1000;
        const next = gaps.find((g) => !solved[g.id] && ms >= g.at);
        if (next) {
          el.pause();
          setWaitingFor(next);
          setTyped("");
          playCue("tick");
        } else if (
          part.duration > 0 &&
          ms >= part.start + part.duration
        ) {
          el.pause();
          setDone(true);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, timeline, gaps, solved]);

  const submit = (event) => {
    event.preventDefault();
    if (!waitingFor) return;
    if (normaliseArabic(typed) !== normaliseArabic(waitingFor.text)) {
      setWrong(true);
      playCue("wrong");
      return;
    }
    playCue("correct");
    setSolved((prev) => ({ ...prev, [waitingFor.id]: true }));
    setWaitingFor(null);
    setWrong(false);
    setTyped("");
    // Carry on from the word just supplied.
    const el = audioRef.current;
    if (el) {
      el.currentTime = waitingFor.at / 1000;
      el.play().catch(() => {});
    }
  };

  const reveal = () => {
    if (!waitingFor) return;
    setSolved((prev) => ({ ...prev, [waitingFor.id]: "revealed" }));
    setWaitingFor(null);
    setWrong(false);
    const el = audioRef.current;
    if (el) el.play().catch(() => {});
  };

  if (!part?.audio) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("recite.none")}</p>
      </div>
    );
  }

  const solvedCount = Object.keys(solved).length;

  return (
    <div className={`space-y-3 ${className}`}>
      <audio
        ref={audioRef}
        src={audioUrl(part.audio)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={start} icon="play">
          {gaps.length ? t("fill.restart") : t("fill.start")}
        </Button>
        {gaps.length > 0 && (
          <Badge variant={solvedCount === gaps.length ? "success" : "neutral"}>
            {t("fill.progress", { done: solvedCount, total: gaps.length })}
          </Badge>
        )}
        {done && <Badge variant="success">{t("fill.finished")}</Badge>}
      </div>

      {waitingFor && (
        <form onSubmit={submit} className="rounded-md border border-primary bg-primary-soft/40 p-3">
          <p className="text-sm font-medium text-ink">{t("fill.whatWord")}</p>
          <div className="mt-2 flex gap-2">
            <input
              dir="rtl"
              autoFocus
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setWrong(false);
              }}
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-ink"
            />
            <Button type="submit" icon="check">
              {t("fill.check")}
            </Button>
            <Button type="button" variant="ghost" onClick={reveal}>
              {t("fill.reveal")}
            </Button>
          </div>
          {wrong && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {t("fill.notThat")}
            </p>
          )}
        </form>
      )}

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageImageUrl(page)}
          alt=""
          className="block w-full"
          onLoad={(e) =>
            setImageSize({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
        />
        {imageSize.width > 0 &&
          gaps.map((gap) => {
            const state = solved[gap.id];
            if (state === true) return null; // solved: leave the page as printed
            return (
              <span
                key={gap.id}
                className={`absolute rounded border-2 ${
                  state === "revealed"
                    ? "border-amber-500 bg-amber-100/70"
                    : waitingFor?.id === gap.id
                      ? "border-primary bg-primary/30"
                      : "border-slate-400 bg-white"
                }`}
                style={regionStyle({
                  x1: gap.x1 / imageSize.width,
                  y1: gap.y1 / imageSize.height,
                  x2: gap.x2 / imageSize.width,
                  y2: gap.y2 / imageSize.height,
                })}
              />
            );
          })}
      </div>

      <p className="text-xs text-ink-muted">{t("fill.hint")}</p>
    </div>
  );
}
