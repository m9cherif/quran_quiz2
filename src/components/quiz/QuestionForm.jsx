"use client";

import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/I18nProvider";

const QUESTION_TYPES = [
  { value: "mcq", key: "typeMcq" },
  { value: "true_false", key: "typeTrueFalse" },
  { value: "text", key: "typeText" },
  { value: "number", key: "typeNumber" },
  { value: "audio", key: "typeAudio" },
];

function buildInitialChoices() {
  return [
    { text: "", position: 1, isCorrect: false, id: null },
    { text: "", position: 2, isCorrect: false, id: null },
    { text: "", position: 3, isCorrect: false, id: null },
    { text: "", position: 4, isCorrect: false, id: null },
  ];
}

export function emptyQuestion(position = 1) {
  return {
    id: null,
    position,
    text: "",
    type: "mcq",
    duration_seconds: 15,
    points: null,
    negative_points: null,
    explanation: null,
    correct_answer_text: null,
    surah_number: null,
    ayah_number: null,
    page_number: null,
    juz_number: null,
    hizb_number: null,
    choices: buildInitialChoices(),
  };
}

/** Fills default points when the question doesn't override them. */
export function questionPoints(question, defaults) {
  return {
    points: question.points ?? defaults.points,
    negative: question.negative_points ?? defaults.negative,
  };
}

export function validateQuestion(question, t = (key) => key) {
  const errors = {};
  if (!question.text.trim()) errors.text = t("editor.missingText");
  if (question.type === "mcq") {
    const filled = question.choices.filter((c) => c.text.trim());
    if (filled.length < 2) {
      errors.choices = t("editor.missingTwoChoices");
    } else if (!filled.some((c) => c.isCorrect)) {
      errors.correct = t("editor.missingCorrectMarker");
    } else if (filled.filter((c) => c.isCorrect).length > 1) {
      errors.correct = t("editor.onlyOneCorrect");
    }
  } else if (question.type === "true_false") {
    // correct_answer_text drives grading for non-mcq types
    if (!question.correct_answer_text?.trim()) {
      errors.correct = t("editor.chooseCorrect");
    }
  } else if (question.type === "text" || question.type === "number") {
    if (!question.correct_answer_text?.trim()) {
      errors.correct = t("editor.missingCorrectText");
    }
  }
  return errors;
}

/**
 * QuestionForm — one question of a quiz: type, text, scoring, timing,
 * choices (mcq), expected answer (text/number/true_false), explanation,
 * and optional Quran reference fields.
 */
export function QuestionForm({
  question,
  defaults,
  errors = {},
  onChange,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}) {
  const { t } = useI18n();
  const typeLabel = (type) =>
    t(`editor.${QUESTION_TYPES.find((item) => item.value === type)?.key ?? "typeText"}`);
  const set = (patch) => onChange({ ...question, ...patch });
  const ref =
    (field) =>
    (e) => {
      const raw = e.target.value;
      set({ [field]: raw === "" ? null : Number(raw) });
    };

  const setChoice = (index, patch) =>
    set({
      choices: question.choices.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });

  const type = question.type;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            {question.position}
          </span>
          <Badge variant="neutral">{typeLabel(type)}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            aria-label={t("editor.moveUp")}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            aria-label={t("editor.moveDown")}
          >
            ↓
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
            {t("common.delete")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label={t("editor.typeLabel")} value={type} onChange={(e) => set({ type: e.target.value })}>
          {QUESTION_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {t(`editor.${item.key}`)}
            </option>
          ))}
        </Select>
        <Input
          label={t("editor.duration")}
          type="number"
          min={1}
          max={600}
          required
          value={question.duration_seconds}
          onChange={(e) => set({ duration_seconds: Math.max(1, Number(e.target.value) || 1) })}
        />
        <Input
          label={`${t("editor.pointsPerQuestion")} (${t("editor.default")} ${defaults.points})`}
          type="number"
          min={0}
          value={question.points ?? ""}
          placeholder={String(defaults.points)}
          onChange={ref("points")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={`${t("editor.negativePoints")} (${t("editor.default")} ${defaults.negative})`}
          type="number"
          max={0}
          value={question.negative_points ?? ""}
          placeholder={String(defaults.negative)}
          onChange={ref("negative_points")}
        />
        <Input
          label={t("editor.explanation")}
          value={question.explanation ?? ""}
          onChange={(e) => set({ explanation: e.target.value || null })}
        />
      </div>

      <Textarea
        label={t("editor.questionText")}
        required
        rows={3}
        value={question.text}
        onChange={(e) => set({ text: e.target.value })}
        error={errors.text}
        placeholder={t("editor.questionTextPlaceholder")}
      />

      {type === "mcq" && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">{t("editor.optionsMark")}</legend>
          <div className="space-y-2.5">
            {question.choices.map((choice, i) => (
              <div key={choice.id ?? `new-${i}`} className={cn("flex items-center gap-2.5")}>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="radio"
                    name={`correct-${question.id ?? "new"}-${question.position}`}
                    checked={choice.isCorrect}
                    onChange={() =>
                      set({ choices: question.choices.map((c) => ({ ...c, isCorrect: false })).map((c, j) => (j === i ? { ...c, isCorrect: true } : c)) })
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="sr-only">{t("editor.markOptionAria", { n: i + 1 })}</span>
                </label>
                <input
                  type="text"
                  value={choice.text}
                  placeholder={`${t("editor.optionWord")} ${i + 1}`}
                  onChange={(e) => setChoice(i, { text: e.target.value })}
                  aria-invalid={errors.choices ? true : undefined}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ choices: question.choices.filter((_, j) => j !== i).map((c, j) => ({ ...c, position: j + 1 })) })}
                  disabled={question.choices.length <= 2}
                  aria-label={t("editor.removeOptionAria", { n: i + 1 })}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set({ choices: [...question.choices, { text: "", position: question.choices.length + 1, isCorrect: false, id: null }] })
              }
            >
              {t("editor.addOption")}
            </Button>
            {(errors.choices || errors.correct) && (
              <p className="self-center text-sm text-danger" role="alert">
                {errors.choices || errors.correct}
              </p>
            )}
          </div>
        </fieldset>
      )}

      {type === "true_false" && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">{t("editor.correctAnswer")}</legend>
          <div className="flex gap-3">
            {[
              { value: "True", label: t("editor.trueOption") },
              { value: "False", label: t("editor.falseOption") },
            ].map(({ value, label }) => {
              const isChecked = question.correct_answer_text === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex-1 cursor-pointer rounded-md border px-4 py-2.5 text-center text-sm font-medium transition-colors",
                    isChecked
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink-muted hover:bg-surface-2"
                  )}
                >
                  <input
                    type="radio"
                    name={`tf-${question.id ?? "new"}-${question.position}`}
                    value={value}
                    checked={isChecked}
                    onChange={() => set({ correct_answer_text: value })}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {errors.correct && (
            <p className="mt-1.5 text-sm text-danger" role="alert">
              {errors.correct}
            </p>
          )}
        </fieldset>
      )}

      {(type === "text" || type === "number") && (
        <Input
          label={type === "number" ? t("editor.correctNumeric") : t("editor.correctTextHint")}
          required
          type={type === "number" ? "number" : "text"}
          value={question.correct_answer_text ?? ""}
          onChange={(e) => set({ correct_answer_text: e.target.value || null })}
          error={errors.correct}
        />
      )}

      <details className="rounded-md border border-border bg-surface px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-medium text-ink">{t("editor.surahRef")}</summary>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label={t("editor.surah")} type="number" min={1} max={114} value={question.surah_number ?? ""} onChange={ref("surah_number")} />
          <Input label={t("editor.ayah")} type="number" min={1} value={question.ayah_number ?? ""} onChange={ref("ayah_number")} />
          <Input label={t("editor.page")} type="number" min={1} value={question.page_number ?? ""} onChange={ref("page_number")} />
          <Input label={t("editor.juz")} type="number" min={1} max={30} value={question.juz_number ?? ""} onChange={ref("juz_number")} />
          <Input label={t("editor.hizb")} type="number" min={1} max={60} value={question.hizb_number ?? ""} onChange={ref("hizb_number")} />
        </div>
      </details>
    </Card>
  );
}

export default QuestionForm;