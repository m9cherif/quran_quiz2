"use client";

import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "text", label: "Text answer" },
  { value: "number", label: "Number answer" },
  { value: "audio", label: "Audio" },
];

const TYPE_LABEL = {
  mcq: "Multiple choice",
  true_false: "True / False",
  text: "Text answer",
  number: "Number answer",
  audio: "Audio",
};

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

export function validateQuestion(question) {
  const errors = {};
  if (!question.text.trim()) errors.text = "Question text is required.";
  if (question.type === "mcq") {
    const filled = question.choices.filter((c) => c.text.trim());
    if (filled.length < 2) {
      errors.choices = "Add at least 2 options.";
    } else if (!filled.some((c) => c.isCorrect)) {
      errors.correct = "Mark one option as the correct answer.";
    } else if (filled.filter((c) => c.isCorrect).length > 1) {
      errors.correct = "Only one option can be the correct answer.";
    }
  } else if (question.type === "true_false") {
    // correct_answer_text drives grading for non-mcq types
    if (!question.correct_answer_text?.trim()) {
      errors.correct = "Choose the correct answer.";
    }
  } else if (question.type === "text" || question.type === "number") {
    if (!question.correct_answer_text?.trim()) {
      errors.correct = "Enter the correct answer (used for scoring).";
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
          <Badge variant="neutral">{TYPE_LABEL[type]}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label="Move question up">
            ↑
          </Button>
          <Button variant="ghost" size="sm" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label="Move question down">
            ↓
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Type" value={type} onChange={(e) => set({ type: e.target.value })}>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Input
          label="Duration (seconds)"
          type="number"
          min={1}
          max={600}
          required
          value={question.duration_seconds}
          onChange={(e) => set({ duration_seconds: Math.max(1, Number(e.target.value) || 1) })}
        />
        <Input
          label={`Points (default ${defaults.points})`}
          type="number"
          min={0}
          value={question.points ?? ""}
          placeholder={String(defaults.points)}
          onChange={ref("points")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={`Negative points (default ${defaults.negative})`}
          type="number"
          max={0}
          value={question.negative_points ?? ""}
          placeholder={String(defaults.negative)}
          onChange={ref("negative_points")}
        />
        <Input
          label="Explanation (shown after reveal)"
          value={question.explanation ?? ""}
          onChange={(e) => set({ explanation: e.target.value || null })}
        />
      </div>

      <Textarea
        label="Question text"
        required
        rows={3}
        value={question.text}
        onChange={(e) => set({ text: e.target.value })}
        error={errors.text}
        placeholder="Type the question…"
      />

      {type === "mcq" && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">
            Options — mark the correct one
          </legend>
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
                  <span className="sr-only">Mark option {i + 1} as correct</span>
                </label>
                <input
                  type="text"
                  value={choice.text}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setChoice(i, { text: e.target.value })}
                  aria-invalid={errors.choices ? true : undefined}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ choices: question.choices.filter((_, j) => j !== i).map((c, j) => ({ ...c, position: j + 1 })) })}
                  disabled={question.choices.length <= 2}
                  aria-label={`Remove option ${i + 1}`}
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
              Add option
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
          <legend className="mb-1.5 block text-sm font-medium text-ink">Correct answer</legend>
          <div className="flex gap-3">
            {["True", "False"].map((value) => {
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
                  {value}
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
          label={type === "number" ? "Correct numeric answer" : "Correct answer (exact text match, case-insensitive)"}
          required
          type={type === "number" ? "number" : "text"}
          value={question.correct_answer_text ?? ""}
          onChange={(e) => set({ correct_answer_text: e.target.value || null })}
          error={errors.correct}
        />
      )}

      <details className="rounded-md border border-border bg-surface px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          Quran reference (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label="Surah" type="number" min={1} max={114} value={question.surah_number ?? ""} onChange={ref("surah_number")} />
          <Input label="Ayah" type="number" min={1} value={question.ayah_number ?? ""} onChange={ref("ayah_number")} />
          <Input label="Page" type="number" min={1} value={question.page_number ?? ""} onChange={ref("page_number")} />
          <Input label="Juz" type="number" min={1} max={30} value={question.juz_number ?? ""} onChange={ref("juz_number")} />
          <Input label="Hizb" type="number" min={1} max={60} value={question.hizb_number ?? ""} onChange={ref("hizb_number")} />
        </div>
      </details>
    </Card>
  );
}

export default QuestionForm;