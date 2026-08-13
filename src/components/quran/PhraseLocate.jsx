"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import PhraseCrop from "./PhraseCrop";
import { pageImageUrl } from "@/lib/quran/pages";
import { audioUrl, loadTimeline } from "@/lib/quran/recitation";
import { sample, splitIntoPhrases } from "@/lib/quran/phrases";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * PhraseLocate — "where on the page is this?"
 *
 * The page is cut at the reciter's pauses, one phrase is played, and the
 * student picks it out from a handful of small readable excerpts. It trains
 * the thing a hafiz actually needs: hearing a fragment and knowing instantly
 * where it sits on the page.
 *
 * The round is over when every phrase on the page has been found.
 */
export default function PhraseLocate({ page, words = [], optionCount = 4, className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const stopRef = useRef(null);

  const [timeline, setTimeline] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [solved, setSolved] = useState([]);
  const [current, setCurrent] = useState(null);
  const [options, setOptions] = useState([]);
  const [wrongIndex, setWrongIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    let active = true;
    setTimeline(null);
    setSolved([]);
    setCurrent(null);
    setMistakes(0);
    loadTimeline(page).then((data) => active && setTimeline(data));
    // The natural size is needed before any crop can be positioned.
    const img = new Image();
    img.onload = () =>
      active && setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = pageImageUrl(page);
    return () => {
      active = false;
      clearTimeout(stopRef.current);
    };
  }, [page]);

  const phrases = useMemo(
    () => (timeline ? splitIntoPhrases(timeline, words) : []),
    [timeline, words]
  );

  const playPhrase = useCallback((phrase) => {
    const el = audioRef.current;
    if (!el || !phrase) return;
    clearTimeout(stopRef.current);
    el.currentTime = phrase.from / 1000;
    el.play().catch(() => {});
    // Stop at the pause that ends the phrase — that boundary is the point.
    stopRef.current = setTimeout(() => el.pause(), Math.max(400, phrase.to - phrase.from));
  }, []);

  /** Deal the next unsolved phrase plus decoys drawn from the same page. */
  const nextRound = useCallback(
    (alreadySolved = solved) => {
      const remaining = phrases.filter((p) => !alreadySolved.includes(p.index));
      if (remaining.length === 0) {
        setCurrent(null);
        return;
      }
      const target = remaining[Math.floor(Math.random() * remaining.length)];
      const decoys = sample(
        phrases.filter((p) => p.index !== target.index),
        Math.max(0, optionCount - 1)
      );
      setCurrent(target);
      setOptions(sample([target, ...decoys], decoys.length + 1));
      setWrongIndex(null);
      setRevealed(false);
      playPhrase(target);
    },
    [phrases, solved, optionCount, playPhrase]
  );

  useEffect(() => {
    if (phrases.length > 0 && current === null && solved.length === 0) nextRound([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases]);

  const choose = (phrase, i) => {
    if (!current || revealed) return;
    if (phrase.index === current.index) {
      playCue("correct");
      const next = [...solved, current.index];
      setSolved(next);
      setTimeout(() => nextRound(next), 450);
    } else {
      playCue("wrong");
      setWrongIndex(i);
      setMistakes((n) => n + 1);
    }
  };

  if (!timeline?.audio) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("recite.none")}</p>
      </div>
    );
  }

  if (phrases.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("locate.noPhrases")}</p>
      </div>
    );
  }

  const finished = solved.length === phrases.length;

  return (
    <div className={`space-y-4 ${className}`}>
      <audio
        ref={audioRef}
        src={audioUrl(timeline.audio)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => playPhrase(current)} disabled={!current} icon={playing ? "pause" : "play"}>
          {t("locate.replay")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setRevealed(true);
            playCue("pop");
          }}
          disabled={!current || revealed}
          icon="eye"
        >
          {t("locate.show")}
        </Button>
        {revealed && (
          <Button
            variant="outline"
            onClick={() => {
              const next = [...solved, current.index];
              setSolved(next);
              nextRound(next);
            }}
            icon="next"
          >
            {t("locate.next")}
          </Button>
        )}
        <Badge variant={finished ? "success" : "neutral"}>
          {t("locate.progress", { done: solved.length, total: phrases.length })}
        </Badge>
        {mistakes > 0 && <Badge variant="warning">{t("locate.mistakes", { count: mistakes })}</Badge>}
      </div>

      {finished ? (
        <div className="rounded-lg border border-success bg-success-soft p-6 text-center">
          <p className="text-lg font-semibold text-success-strong">{t("locate.done")}</p>
          <Button
            className="mt-3"
            icon="refresh"
            onClick={() => {
              setSolved([]);
              setMistakes(0);
              nextRound([]);
            }}
          >
            {t("locate.again")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t("locate.prompt")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option, i) => {
              const isAnswer = revealed && option.index === current?.index;
              const isWrong = wrongIndex === i;
              return (
                <button
                  key={`${option.index}-${i}`}
                  type="button"
                  onClick={() => choose(option, i)}
                  className={`press rounded-lg p-1 text-start transition-transform ${
                    isWrong ? "animate-shake" : ""
                  }`}
                >
                  <PhraseCrop
                    page={page}
                    box={option.box}
                    imageSize={imageSize}
                    highlight={isAnswer}
                    className={isWrong ? "border-danger ring-2 ring-danger" : ""}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Solved phrases stay on screen, so the page rebuilds itself as the
          round goes on. */}
      {solved.length > 0 && !finished && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-ink-muted">{t("locate.found")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {solved.map((index) => {
              const phrase = phrases.find((p) => p.index === index);
              if (!phrase) return null;
              return (
                <PhraseCrop
                  key={`solved-${index}`}
                  page={page}
                  box={phrase.box}
                  imageSize={imageSize}
                  className="opacity-70"
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
