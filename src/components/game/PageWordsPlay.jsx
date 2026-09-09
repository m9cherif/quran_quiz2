"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpenQuranView } from "open-quran-view/view";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { normaliseArabic, stripTashkeel } from "@/lib/quran/pages";
import { LOCATE_MARKER_COLOR, MUSHAF_LAYOUT, locateWords } from "@/lib/quran/openView";
import RecitationReplay from "@/components/quran/RecitationReplay";

/**
 * PageWordsPlay — the student half of the "mots cachés" exercise.
 *
 * The page is real text now (open-quran-view), not a scanned image with
 * pixel boxes drawn over it — so the masked boxes are positioned by reading
 * the rendered word elements back off the DOM (see locateWords) rather than
 * from stored coordinates. Everything past that — tap a chip then tap a box,
 * drag the chip onto the box, type the word — is unchanged: the answer is
 * still the chip index per box, joined with "|", which is what the server
 * already grades by string equality.
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
  const wordLocations = useMemo(
    () => (Array.isArray(question.word_locations) ? question.word_locations : []),
    [question.word_locations]
  );
  const [placements, setPlacements] = useState(() => wordLocations.map(() => null));
  const [activeChip, setActiveChip] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [typed, setTyped] = useState("");
  const [typeError, setTypeError] = useState("");
  const [boxes, setBoxes] = useState([]);
  const containerRef = useRef(null);

  const solutionByRegion = useMemo(() => {
    if (!solution) return null;
    return String(solution)
      .split("|")
      .map((v) => Number(v));
  }, [solution]);

  const usedChips = new Set(placements.filter((p) => p !== null));
  const placedCount = placements.filter((p) => p !== null).length;
  const allPlaced = placedCount === wordLocations.length && wordLocations.length > 0;

  const firstEmpty = placements.findIndex((p) => p === null);
  const canonical = placements.map((p) => (p === null ? -1 : p)).join("|");

  /**
   * The masked words are marked with a reserved highlight colour on every
   * render (see LOCATE_MARKER_COLOR) purely so their rendered position can be
   * read back — locateWords finds them by that colour, not by the click that
   * produced them, since the student never clicks the real word underneath.
   */
  const measureBoxes = () => {
    const container = containerRef.current;
    if (!container) return;
    const found = locateWords(container);
    if (found.length === wordLocations.length) {
      setBoxes(found.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })));
    }
  };

  useEffect(() => {
    setPlacements(wordLocations.map(() => null));
    setBoxes([]);
  }, [wordLocations]);

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
          {t("pw.progress", { placed: placedCount, total: wordLocations.length })}
        </Badge>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border border-border bg-white p-2"
      >
        <OpenQuranView
          key={question.page_number}
          page={question.page_number}
          mushafLayout={MUSHAF_LAYOUT}
          width={640}
          highlightedWords={wordLocations}
          wordHighlightColor={LOCATE_MARKER_COLOR}
          onLoad={() => {
            // Two frames: the highlight is applied in the same render as the
            // layout, but painting it is not guaranteed done until after.
            requestAnimationFrame(() => requestAnimationFrame(measureBoxes));
          }}
        />

        {boxes.map((box, i) => {
          const chipIndex = placements[i];
          const filled = chipIndex !== null;
          const truth = solutionByRegion ? solutionByRegion[i] : null;
          const graded = solutionByRegion !== null;
          const right = graded && filled && truth === chipIndex;

          return (
            <button
              key={`w-${i}`}
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
              className={`absolute flex items-center justify-center overflow-hidden rounded text-center text-[11px] font-semibold leading-tight transition-colors sm:text-sm ${
                graded
                  ? right
                    ? // Right answer: get out of the way entirely so the word
                      // itself is read off the page, as it is printed.
                      "border-0 bg-white"
                    : "border-2 border-rose-500 bg-rose-100 text-rose-900"
                  : filled
                    ? "border-2 border-primary bg-primary-soft text-primary"
                    : activeRegion === i
                      ? "border-2 border-solid border-primary bg-primary/20 text-primary ring-2 ring-primary"
                      : "border-2 border-dashed border-rose-400 bg-white text-slate-400 hover:bg-slate-50"
              }`}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            >
              <span dir="rtl" className="px-0.5">
                {graded
                  ? // A correct box shows nothing: the printed word is the
                    // answer. A wrong one names the word that belonged there.
                    right
                    ? ""
                    : truth !== null && truth !== undefined
                      ? chipLabel(truth)
                      : ""
                  : filled
                    ? chipLabel(chipIndex)
                    : i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* Once the question is graded, hear the page read back: the third use of
          the recitation data, and the moment a learner most wants it. */}
      {solution && <RecitationReplay page={question.page_number} />}

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
              : t("pw.submitPartial", { placed: placedCount, total: wordLocations.length })}
          </Button>
          <p className="text-center text-xs text-ink-muted">{t("pw.autosaveHint")}</p>
        </>
      )}
    </div>
  );
}
