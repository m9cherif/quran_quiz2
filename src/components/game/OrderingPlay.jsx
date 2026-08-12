"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * OrderingPlay — arrange the fragments into the right sequence.
 * The chips arrive shuffled from the server (display order carries no hint),
 * and the answer is "which chip sits in slot 0 | slot 1 | …" — the same
 * canonical shape page exercises use, so grading stays server-side and partial
 * placements still earn their share of the points.
 */
export default function OrderingPlay({
  question,
  chips,
  onSubmit,
  onProgress,
  submitting,
  disabled = false,
  solution = null,
}) {
  const { t } = useI18n();
  const total = chips.length;
  const [slots, setSlots] = useState(() => Array.from({ length: total }, () => null));

  const solutionSlots = useMemo(() => {
    if (!solution) return null;
    return String(solution).split("|").map((v) => Number(v));
  }, [solution]);

  const used = new Set(slots.filter((s) => s !== null));
  const placed = slots.filter((s) => s !== null).length;
  const canonical = slots.map((s) => (s === null ? -1 : s)).join("|");

  const push = (next) => {
    setSlots(next);
    if (onProgress && next.some((s) => s !== null)) {
      onProgress(next.map((s) => (s === null ? -1 : s)).join("|"));
    }
  };

  /** Tapping a chip drops it into the first free slot. */
  const addChip = (chipIndex) => {
    if (disabled || used.has(chipIndex)) return;
    const free = slots.findIndex((s) => s === null);
    if (free === -1) return;
    push(slots.map((s, i) => (i === free ? chipIndex : s)));
  };

  /** Tapping a filled slot returns that chip to the pool. */
  const clearSlot = (slotIndex) => {
    if (disabled) return;
    push(slots.map((s, i) => (i === slotIndex ? null : s)));
  };

  const move = (slotIndex, delta) => {
    const target = slotIndex + delta;
    if (disabled || target < 0 || target >= total) return;
    const next = [...slots];
    [next[slotIndex], next[target]] = [next[target], next[slotIndex]];
    push(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{t("ord.hint")}</p>
        <Badge variant={placed === total ? "success" : "neutral"}>
          {t("ord.progress", { placed, total })}
        </Badge>
      </div>

      <ol className="space-y-2">
        {slots.map((chipIndex, slotIndex) => {
          const filled = chipIndex !== null;
          const truth = solutionSlots ? solutionSlots[slotIndex] : null;
          const graded = solutionSlots !== null;
          const right = graded && filled && truth === chipIndex;

          return (
            <li key={`slot-${slotIndex}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
                {slotIndex + 1}
              </span>
              <button
                type="button"
                disabled={disabled && !graded}
                onClick={() => (filled && !graded ? clearSlot(slotIndex) : undefined)}
                className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-start text-base transition-colors ${
                  graded
                    ? right
                      ? "border-success bg-success-soft text-success-strong"
                      : "border-danger bg-danger-soft text-danger-strong"
                    : filled
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-dashed border-border bg-surface text-ink-faint"
                }`}
              >
                <span dir="rtl">
                  {graded && truth !== null && truth !== undefined
                    ? chips[truth]?.text
                    : filled
                      ? chips[chipIndex]?.text
                      : t("ord.emptySlot")}
                </span>
              </button>
              {!disabled && filled && (
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(slotIndex, -1)}
                    disabled={slotIndex === 0}
                    aria-label={t("editor.moveUp")}
                    className="px-2 text-xs text-ink-muted disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(slotIndex, 1)}
                    disabled={slotIndex === total - 1}
                    aria-label={t("editor.moveDown")}
                    className="px-2 text-xs text-ink-muted disabled:opacity-30"
                  >
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!disabled && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("ord.poolAria")}>
            {chips.map((chip, index) => (
              <button
                key={chip.id ?? index}
                type="button"
                onClick={() => addChip(index)}
                disabled={used.has(index)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-base font-semibold text-ink transition-colors hover:border-primary disabled:opacity-40"
              >
                <span dir="rtl">{chip.text}</span>
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={placed === 0}
            onClick={() => onSubmit(canonical)}
          >
            {placed === total
              ? t("game.submitAnswer")
              : t("pw.submitPartial", { placed, total })}
          </Button>
          <p className="text-center text-xs text-ink-muted">{t("pw.autosaveHint")}</p>
        </>
      )}
    </div>
  );
}
