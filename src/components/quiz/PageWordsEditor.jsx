"use client";

import { useEffect, useState } from "react";
import { OpenQuranView } from "open-quran-view/view";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  MUSHAF_LAYOUT,
  MUSHAF_PAGE_COUNT,
  loadPageWords,
  loadWordIndex,
  wordKey,
} from "@/lib/quran/openView";

const PAGE_NUMBERS = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, i) => i + 1);

/** Ascending surah, then verse, then word position — the page's own reading order. */
function byReadingOrder(a, b) {
  return a.surah - b.surah || a.verse - b.verse || a.position - b.position;
}

/**
 * PageWordsEditor — the authoring half of the "mots cachés" exercise.
 *
 * The host clicks words directly on the real page — rendered by
 * open-quran-view, not a scanned image — to mark them hidden; clicking again
 * un-marks them. Each hidden word is stored as where it actually is in the
 * text (surah, verse, position) rather than a pixel box, so the exercise
 * survives however the page happens to be rendered.
 */
export default function PageWordsEditor({ question, onChange }) {
  const { t } = useI18n();
  const page = question.page_number ?? PAGE_NUMBERS[0];
  const wordLocations = question.word_locations ?? [];
  const words = question.words ?? [];

  const [wordTextIndex, setWordTextIndex] = useState(new Map());
  const [hideCount, setHideCount] = useState(8);
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState("");

  useEffect(() => {
    let active = true;
    loadWordIndex(page).then((idx) => {
      if (active) setWordTextIndex(idx);
    });
    return () => {
      active = false;
    };
  }, [page]);

  const set = (patch) => onChange({ ...question, ...patch });

  /**
   * Pick `hideCount` random words from this page's own text — a random
   * sample of the full deck, same as the old "Aléatoire (N mots)" mode,
   * just sourced from the real page data instead of a separately maintained
   * annotation workbook (which is also why every page always has some to
   * pick from, unlike that workbook, which often had none for a given page).
   */
  const autoFill = async () => {
    setFilling(true);
    setFillError("");
    try {
      const all = await loadPageWords(page);
      if (!all.length) {
        setFillError(t("pw.autoFillFailed"));
        return;
      }
      const pool = [...all];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const chosen = pool
        .slice(0, Math.max(1, Math.min(hideCount, pool.length, 40)))
        .sort(byReadingOrder);
      set({
        word_locations: chosen.map((w) => ({ surah: w.surah, verse: w.verse, position: w.position })),
        words: chosen.map((w) => w.text),
      });
    } catch (err) {
      console.error("Auto-fill failed:", err);
      setFillError(t("pw.autoFillFailed"));
    } finally {
      setFilling(false);
    }
  };

  const toggleWord = (word) => {
    // Ayah-end roundels and other decoration are not selectable words.
    if (word.charType && word.charType !== "word") return;
    const loc = { surah: word.surahNumber, verse: word.ayahNumber, position: word.position };
    if (!loc.surah || !loc.verse || !loc.position) return;
    const key = wordKey(loc);

    const pairs = wordLocations.map((l, i) => ({ loc: l, text: words[i] }));
    const existingIndex = pairs.findIndex((p) => wordKey(p.loc) === key);
    let nextPairs;
    if (existingIndex >= 0) {
      nextPairs = pairs.filter((_, i) => i !== existingIndex);
    } else {
      if (pairs.length >= 40) return; // matches the server-side limit
      nextPairs = [...pairs, { loc, text: wordTextIndex.get(key) ?? "" }];
    }
    nextPairs.sort((a, b) => byReadingOrder(a.loc, b.loc));
    set({
      word_locations: nextPairs.map((p) => p.loc),
      words: nextPairs.map((p) => p.text),
    });
  };

  const removeWord = (index) => {
    set({
      word_locations: wordLocations.filter((_, i) => i !== index),
      words: words.filter((_, i) => i !== index),
    });
  };

  const missing =
    wordLocations.length === 0 || words.some((w) => !String(w ?? "").trim());

  return (
    <Card className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label={t("pw.pageLabel")}
          value={String(page)}
          onChange={(e) => set({ page_number: Number(e.target.value) })}
        >
          {PAGE_NUMBERS.map((p) => (
            <option key={p} value={p}>
              {t("pw.pageOption", { page: p })}
            </option>
          ))}
        </Select>
        <Input
          label={t("editor.duration")}
          type="number"
          min={10}
          max={600}
          value={question.duration_seconds ?? 120}
          onChange={(e) =>
            set({ duration_seconds: Math.max(10, Number(e.target.value) || 120) })
          }
        />
        <Input
          label={t("editor.pointsPerQuestion")}
          type="number"
          min={0}
          value={question.points ?? ""}
          onChange={(e) =>
            set({ points: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-2 p-3">
        <div className="w-28">
          <Input
            label={t("pw.hideCount")}
            type="number"
            min={1}
            max={40}
            value={hideCount}
            onChange={(e) => setHideCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <Button loading={filling} onClick={autoFill} disabled={wordTextIndex.size === 0}>
          {t("pw.autoFill")}
        </Button>
        {wordTextIndex.size > 0 && (
          <p className="flex-1 text-xs text-ink-muted">
            {t("pw.annotatedWords", { count: wordTextIndex.size })}
          </p>
        )}
        {fillError && (
          <p className="w-full text-sm text-danger" role="alert">
            {fillError}
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">{t("pw.clickHint")}</p>
          <Badge variant={missing ? "warning" : "success"}>
            {t("pw.boxCount", { count: wordLocations.length })}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white p-2">
          <OpenQuranView
            key={page}
            page={page}
            mushafLayout={MUSHAF_LAYOUT}
            highlightedWords={wordLocations}
            wordHighlightColor="rgba(37, 99, 235, 0.35)"
            onWordClick={toggleWord}
          />
        </div>
      </div>

      {wordLocations.length > 0 && (
        <ol className="space-y-2">
          {wordLocations.map((loc, i) => (
            <li key={wordKey(loc)} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
                {i + 1}
              </span>
              <span dir="rtl" className="min-w-0 flex-1 text-base text-ink">
                {words[i] || t("pw.wordPlaceholder")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => removeWord(i)}
                aria-label={t("pw.removeBox", { n: i + 1 })}
              >
                ×
              </Button>
            </li>
          ))}
        </ol>
      )}

      {missing && <p className="text-sm text-warning-strong">{t("pw.incomplete")}</p>}
    </Card>
  );
}
