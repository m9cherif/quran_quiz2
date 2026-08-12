"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { normaliseArabic, pageImageUrl, regionStyle, stripTashkeel } from "@/lib/quran/pages";

/**
 * PageWordsPlay — the student half of the "mots cachés" exercise.
 * The masked boxes sit on top of the page image; tap a word chip then tap a
 * box (the PyQt flow: pick the word number, click the empty cell), or drag the
 * chip onto the box. The answer is the chip index per box, joined with "|",
 * which is exactly what the server stored as the solution — so grading stays
 * server-side and the key is never in the page.
 */
export default function PageWordsPlay({
  question,
  chips,
  onSubmit,
  onProgress,
  submitting,
  disabled = false,
  solution = null,
}) {
  const { t } = useI18n();
  const regions = useMemo(
    () => (Array.isArray(question.regions) ? question.regions : []),
    [question.regions]
  );
  const [placements, setPlacements] = useState(() => regions.map(() => null));
  const [activeChip, setActiveChip] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [typed, setTyped] = useState("");
  const [typeError, setTypeError] = useState("");
  const imageUrl = pageImageUrl(question.page_number);

  const solutionByRegion = useMemo(() => {
    if (!solution) return null;
    return String(solution)
      .split("|")
      .map((v) => Number(v));
  }, [solution]);

  const usedChips = new Set(placements.filter((p) => p !== null));
  const placedCount = placements.filter((p) => p !== null).length;
  const allPlaced = placedCount === regions.length && regions.length > 0;

  const firstEmpty = placements.findIndex((p) => p === null);
  const canonical = placements.map((p) => (p === null ? -1 : p)).join("|");

  /**
   * Push every change to the server shortly after it happens, so the grade
   * reflects what was on screen when the timer ran out — pressing "submit" is
   * a confirmation, not the only way the work is saved.
   */
  const savedRef = useRef("");
  useEffect(() => {
    if (disabled || !onProgress || placedCount === 0) return;
    if (savedRef.current === canonical) return;
    const id = setTimeout(() => {
      savedRef.current = canonical;
      onProgress(canonical);
    }, 600);
    return () => clearTimeout(id);
  }, [canonical, placedCount, disabled, onProgress]);

  const placeChip = (regionIndex, chipIndex) => {
    if (disabled || chipIndex === null || regionIndex === null || regionIndex < 0) return;
    setPlacements((prev) =>
      prev.map((p, i) => {
        if (i === regionIndex) return chipIndex;
        return p === chipIndex ? null : p; // a chip lives in one box only
      })
    );
    setActiveChip(null);
    setActiveRegion(null);
    setTyped("");
    setTypeError("");
  };

  const clearRegion = (regionIndex) => {
    if (disabled) return;
    setPlacements((prev) => prev.map((p, i) => (i === regionIndex ? null : p)));
  };

  /** Tapping a box: fill it if a chip is armed, otherwise arm the box itself. */
  const handleRegionTap = (regionIndex) => {
    if (activeChip !== null) {
      placeChip(regionIndex, activeChip);
      return;
    }
    setActiveRegion((prev) => (prev === regionIndex ? null : regionIndex));
    setTyped("");
    setTypeError("");
  };

  /** Tapping a chip: drop it into the armed box, else the first empty one. */
  const handleChipTap = (chipIndex) => {
    const target = activeRegion !== null ? activeRegion : firstEmpty;
    if (target >= 0) {
      placeChip(target, chipIndex);
      return;
    }
    setActiveChip((prev) => (prev === chipIndex ? null : chipIndex));
  };

  /**
   * Typing route: match what the student wrote against the remaining words,
   * ignoring harakat and spelling variants, and place that chip.
   */
  const submitTyped = (event) => {
    event.preventDefault();
    if (disabled) return;
    const target = activeRegion !== null ? activeRegion : firstEmpty;
    if (target < 0) return;

    const needle = normaliseArabic(typed);
    if (!needle) return;

    const match = chips.findIndex(
      (chip, i) => !usedChips.has(i) && normaliseArabic(chip.text) === needle
    );
    if (match === -1) {
      setTypeError(t("pw.noSuchWord"));
      return;
    }
    placeChip(target, match);
  };

  const chipLabel = (index) => chips[index]?.text ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="info">{t("pw.pageOption", { page: question.page_number })}</Badge>
        <Badge variant={allPlaced ? "success" : "neutral"}>
          {t("pw.progress", { placed: placedCount, total: regions.length })}
        </Badge>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={t("pw.pageOption", { page: question.page_number })}
          className="block w-full"
          draggable={false}
        />

        {regions.map((region, i) => {
          const chipIndex = placements[i];
          const filled = chipIndex !== null;
          const truth = solutionByRegion ? solutionByRegion[i] : null;
          const graded = solutionByRegion !== null;
          const right = graded && filled && truth === chipIndex;

          return (
            <button
              key={`r-${i}`}
              type="button"
              disabled={disabled && !graded}
              onClick={() => (filled && !graded ? clearRegion(i) : handleRegionTap(i))}
              onDragOver={(e) => {
                if (!disabled) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const idx = Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(idx)) placeChip(i, idx);
              }}
              aria-label={t("pw.boxAria", { n: i + 1 })}
              className={`absolute flex items-center justify-center overflow-hidden rounded border-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-sm ${
                graded
                  ? right
                    ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                    : "border-rose-500 bg-rose-100 text-rose-900"
                  : filled
                    ? "border-primary bg-primary-soft text-primary"
                    : activeRegion === i
                      ? "border-solid border-primary bg-primary/20 text-primary ring-2 ring-primary"
                      : "border-dashed border-rose-400 bg-white text-slate-400 hover:bg-slate-50"
              }`}
              style={regionStyle(region)}
            >
              <span dir="rtl" className="px-0.5">
                {graded && truth !== null && truth !== undefined
                  ? chipLabel(truth)
                  : filled
                    ? chipLabel(chipIndex)
                    : i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {!disabled && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("pw.wordsAria")}>
            {chips.map((chip, index) => {
              const used = usedChips.has(index);
              return (
                <button
                  key={chip.id ?? index}
                  type="button"
                  draggable={!used}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
                  onClick={() => handleChipTap(index)}
                  disabled={used}
                  className={`rounded-lg border px-3 py-2 text-base font-semibold transition-colors disabled:opacity-40 ${
                    activeChip === index
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink hover:border-primary"
                  }`}
                >
                  <span className="me-2 text-xs font-bold text-ink-faint">{index + 1}</span>
                  <span dir="rtl">{stripTashkeel(chip.text)}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={submitTyped} className="space-y-1.5">
            <label htmlFor="pw-typed" className="block text-sm font-medium text-ink">
              {activeRegion !== null
                ? t("pw.typeForBox", { n: activeRegion + 1 })
                : t("pw.typeNext")}
            </label>
            <div className="flex gap-2">
              <input
                id="pw-typed"
                dir="rtl"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setTypeError("");
                }}
                placeholder={t("pw.typePlaceholder")}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-ink outline-none focus:border-primary focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
              />
              <Button type="submit" variant="outline" disabled={!typed.trim()}>
                {t("pw.place")}
              </Button>
            </div>
            {typeError && (
              <p className="text-sm text-danger" role="alert">
                {typeError}
              </p>
            )}
          </form>

          <p className="text-xs text-ink-muted">{t("pw.playHint")}</p>

          {/* Partial work counts, so the button is never a dead end. */}
          <Button
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={placedCount === 0}
            onClick={() => onSubmit(canonical)}
          >
            {allPlaced
              ? t("game.submitAnswer")
              : t("pw.submitPartial", { placed: placedCount, total: regions.length })}
          </Button>
          <p className="text-center text-xs text-ink-muted">{t("pw.autosaveHint")}</p>
        </>
      )}
    </div>
  );
}
