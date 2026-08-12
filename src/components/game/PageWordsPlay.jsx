"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { pageImageUrl, regionStyle } from "@/lib/quran/pages";

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

  const placeChip = (regionIndex, chipIndex) => {
    if (disabled || chipIndex === null) return;
    setPlacements((prev) =>
      prev.map((p, i) => {
        if (i === regionIndex) return chipIndex;
        return p === chipIndex ? null : p; // a chip lives in one box only
      })
    );
    setActiveChip(null);
  };

  const clearRegion = (regionIndex) => {
    if (disabled) return;
    setPlacements((prev) => prev.map((p, i) => (i === regionIndex ? null : p)));
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
              onClick={() => (filled && !graded ? clearRegion(i) : placeChip(i, activeChip))}
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
                  onClick={() => setActiveChip(activeChip === index ? null : index)}
                  disabled={used}
                  className={`rounded-lg border px-3 py-2 text-base font-semibold transition-colors disabled:opacity-40 ${
                    activeChip === index
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink hover:border-primary"
                  }`}
                >
                  <span className="me-2 text-xs font-bold text-ink-faint">{index + 1}</span>
                  <span dir="rtl">{chip.text}</span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-ink-muted">{t("pw.playHint")}</p>

          <Button
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={!allPlaced}
            onClick={() => onSubmit(placements.map((p) => (p === null ? -1 : p)).join("|"))}
          >
            {t("game.submitAnswer")}
          </Button>
        </>
      )}
    </div>
  );
}
