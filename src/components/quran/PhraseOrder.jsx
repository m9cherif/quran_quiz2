"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import PhraseCrop from "./PhraseCrop";
import { pageImageUrl } from "@/lib/quran/pages";
import { audioUrl, loadTimeline } from "@/lib/quran/recitation";
import { sample, splitIntoPhrases } from "@/lib/quran/phrases";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * PhraseOrder — rebuild the page from its phrases.
 *
 * The same pause-detected phrases, shuffled and shown as small readable
 * excerpts; the student puts them back into recitation order. Where
 * PhraseLocate asks "where is this?", this asks "what follows what" — the
 * other half of knowing a page.
 *
 * Each phrase can be heard on its own, so a student who is unsure listens
 * rather than guesses.
 */
export default function PhraseOrder({ page, words = [], className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const stopRef = useRef(null);

  const [timeline, setTimeline] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [pool, setPool] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [checked, setChecked] = useState(null);

  useEffect(() => {
    let active = true;
    setTimeline(null);
    loadTimeline(page).then((data) => active && setTimeline(data));
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

  // A whole page of phrases is too many to order at once; take a run of six.
  const round = useMemo(() => {
    if (phrases.length === 0) return [];
    const size = Math.min(6, phrases.length);
    const start = Math.floor(Math.random() * (phrases.length - size + 1));
    return phrases.slice(start, start + size);
  }, [phrases]);

  useEffect(() => {
    setPool(sample(round, round.length));
    setPlaced([]);
    setChecked(null);
  }, [round]);

  const hear = (phrase) => {
    const el = audioRef.current;
    if (!el) return;
    clearTimeout(stopRef.current);
    el.currentTime = phrase.from / 1000;
    el.play().catch(() => {});
    stopRef.current = setTimeout(() => el.pause(), Math.max(400, phrase.to - phrase.from));
  };

  const take = (phrase) => {
    if (checked) return;
    setPool((prev) => prev.filter((p) => p.index !== phrase.index));
    setPlaced((prev) => [...prev, phrase]);
    hear(phrase);
  };

  const putBack = (phrase) => {
    if (checked) return;
    setPlaced((prev) => prev.filter((p) => p.index !== phrase.index));
    setPool((prev) => [...prev, phrase]);
  };

  const check = () => {
    const correct = round.map((p) => p.index);
    const given = placed.map((p) => p.index);
    const rights = given.filter((id, i) => id === correct[i]).length;
    setChecked({ rights, total: correct.length });
    playCue(rights === correct.length ? "celebrate" : "wrong");
  };

  const reset = () => {
    setPool(sample(round, round.length));
    setPlaced([]);
    setChecked(null);
  };

  if (!timeline?.audio) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("recite.none")}</p>
      </div>
    );
  }
  if (round.length < 2) {
    return (
      <div className={`rounded-lg border border-dashed border-border p-6 text-center ${className}`}>
        <p className="text-sm text-ink-muted">{t("locate.noPhrases")}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <audio ref={audioRef} src={audioUrl(timeline.audio)} preload="none" />

      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-ink-muted">{t("order.prompt")}</p>
        <Badge variant="neutral">{t("order.count", { count: round.length })}</Badge>
        <Button variant="ghost" icon="refresh" onClick={reset}>
          {t("common.reset")}
        </Button>
        <Button icon="check" onClick={check} disabled={placed.length !== round.length || checked}>
          {t("dictation.check")}
        </Button>
      </div>

      <ol className="space-y-2">
        {placed.map((phrase, i) => {
          const right = checked ? round[i]?.index === phrase.index : null;
          return (
            <li key={`placed-${phrase.index}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => (checked ? hear(phrase) : putBack(phrase))}
                className={`press min-w-0 flex-1 rounded-md p-1 ${
                  checked
                    ? right
                      ? "bg-success-soft"
                      : "bg-danger-soft"
                    : "hover:bg-surface-2"
                }`}
              >
                <PhraseCrop page={page} box={phrase.box} imageSize={imageSize} />
              </button>
            </li>
          );
        })}
        {placed.length < round.length && (
          <li className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
              {placed.length + 1}
            </span>
            <span className="flex-1 rounded-md border border-dashed border-border py-4 text-center text-xs text-ink-faint">
              {t("order.slot")}
            </span>
          </li>
        )}
      </ol>

      {checked ? (
        <div className="rounded-md border border-border bg-surface-2 p-3 text-center">
          <p className="text-sm font-semibold text-ink">
            {t("order.score", { score: checked.rights, total: checked.total })}
          </p>
          <Button className="mt-2" icon="refresh" onClick={reset}>
            {t("locate.again")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {pool.map((phrase) => (
            <div key={`pool-${phrase.index}`} className="space-y-1">
              <button type="button" onClick={() => take(phrase)} className="press w-full text-start">
                <PhraseCrop page={page} box={phrase.box} imageSize={imageSize} />
              </button>
              <button
                type="button"
                onClick={() => hear(phrase)}
                className="w-full rounded border border-border py-1 text-xs text-ink-muted hover:text-ink"
              >
                ▶ {t("order.hear")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
