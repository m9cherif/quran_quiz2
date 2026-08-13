"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { normaliseArabic } from "@/lib/quran/pages";
import { audioUrl, loadTimeline, timeOfWord } from "@/lib/quran/recitation";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * AyahDictation — hear one ayah, write it down.
 *
 * The timeline supplies the exact bounds of a single ayah inside a whole-surah
 * recording, so one verse can be played in isolation and repeated; the mp3
 * supplies the voice. Marking ignores harakat and the usual spelling variants,
 * and shows a word-by-word comparison rather than a bare right/wrong.
 */
export default function AyahDictation({ page, words = [], className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const stopRef = useRef(null);

  const [timeline, setTimeline] = useState(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    loadTimeline(page).then((data) => active && setTimeline(data));
    return () => {
      active = false;
    };
  }, [page]);

  /** Ayahs that exist both on the page and in the recording. */
  const ayahs = useMemo(() => {
    if (!timeline) return [];
    const groups = new Map();
    for (const word of words) {
      if (!word.aya || word.id == null) continue;
      const at = timeOfWord(timeline, word.id);
      if (at == null) continue;
      const entry = groups.get(word.aya) ?? { aya: word.aya, from: at, to: at, words: [] };
      entry.from = Math.min(entry.from, at);
      entry.to = Math.max(entry.to, at);
      entry.words.push(word);
      groups.set(word.aya, entry);
    }
    const list = [...groups.values()].sort((a, b) => a.from - b.from);
    return list.map((item, i) => ({
      ...item,
      to: i + 1 < list.length ? list[i + 1].from : timeline.start + timeline.duration,
      text: item.words.map((w) => w.text).join(" "),
    }));
  }, [words, timeline]);

  const current = ayahs[index] ?? null;

  const play = () => {
    const el = audioRef.current;
    if (!el || !current) return;
    el.currentTime = current.from / 1000;
    el.play().catch(() => {});
    clearTimeout(stopRef.current);
    // Stop at the ayah boundary: the recording keeps going, the exercise does not.
    stopRef.current = setTimeout(() => el.pause(), Math.max(300, current.to - current.from));
  };

  useEffect(() => () => clearTimeout(stopRef.current), []);

  const check = () => {
    if (!current) return;
    const expected = current.text.split(/\s+/).filter(Boolean);
    const got = typed.split(/\s+/).filter(Boolean);
    const marks = expected.map((word, i) => ({
      word,
      typed: got[i] ?? "",
      ok: normaliseArabic(got[i] ?? "") === normaliseArabic(word),
    }));
    const score = marks.filter((m) => m.ok).length;
    setChecked({ marks, score, total: expected.length });
    playCue(score === expected.length ? "correct" : "wrong");
  };

  const next = () => {
    setIndex((i) => (i + 1) % Math.max(1, ayahs.length));
    setTyped("");
    setChecked(null);
  };

  if (!timeline?.audio || ayahs.length === 0) {
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

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={play} icon={playing ? "pause" : "play"}>
          {t("dictation.listen")}
        </Button>
        <Button variant="ghost" onClick={next} icon="next">
          {t("dictation.next")}
        </Button>
        <Badge variant="neutral">
          {t("dictation.ayahOf", { n: index + 1, total: ayahs.length })}
        </Badge>
      </div>

      <textarea
        dir="rtl"
        rows={3}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={t("dictation.placeholder")}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-lg text-ink"
      />

      <div className="flex gap-2">
        <Button onClick={check} icon="check" disabled={!typed.trim()}>
          {t("dictation.check")}
        </Button>
      </div>

      {checked && (
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <p className="text-sm font-semibold text-ink">
            {t("dictation.score", { score: checked.score, total: checked.total })}
          </p>
          <p dir="rtl" className="mt-2 flex flex-wrap gap-1.5 text-lg">
            {checked.marks.map((mark, i) => (
              <span
                key={i}
                className={`rounded px-1.5 ${
                  mark.ok
                    ? "bg-success-soft text-success-strong"
                    : "bg-danger-soft text-danger-strong line-through decoration-1"
                }`}
                title={mark.ok ? "" : `${t("answers.expected")}: ${mark.word}`}
              >
                {mark.typed || "—"}
              </span>
            ))}
          </p>
          {checked.score < checked.total && (
            <p dir="rtl" className="mt-2 text-sm text-ink-muted">
              {current.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
