"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import {
  deleteQuestion,
  getQuestionFull,
  getQuiz,
  listQuizQuestions,
  saveQuestion,
  setQuizStatus,
  updateQuizMeta,
} from "@/services/quizzes";
import { Dialog } from "@/components/ui/Dialog";
import { listMyClasses } from "@/services/classes";
import {
  QuestionForm,
  emptyQuestion,
  validateQuestion,
  questionPoints,
} from "./QuestionForm";
import QuestionPreview from "./QuestionPreview";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * QuizEditor — full quiz management: meta settings, question list with
 * move/add/delete, per-question form (all types), and a student-facing
 * preview. Persistence via owner-scoped RPCs; one "Save" persists all.
 */
export function QuizEditor({ quizId }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const typeLabel = (type) => {
    const labels = {
      mcq: t("editor.typeMcq"),
      true_false: t("editor.typeTrueFalse"),
      text: t("editor.typeText"),
      number: t("editor.typeNumber"),
      audio: t("editor.typeAudio"),
    };
    return labels[type] ?? type;
  };

  const [state, setState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [classes, setClasses] = useState([]);

  const isDraft = quiz?.status === "draft";

  const load = useCallback(async () => {
    setState("loading");
    setLoadError("");
    try {
      const competition = await getQuiz(quizId);
      if (!competition) {
        setLoadError(t("editor.loadNotFound"));
        setState("error");
        return;
      }
      const items = await listQuizQuestions(quizId);
      const full = [];
      for (const item of items) {
        try {
          const f = await getQuestionFull(item.id);
          full.push({
            id: f.id,
            position: f.position,
            text: f.text,
            type: f.type,
            duration_seconds: f.duration_seconds,
            points: f.points,
            negative_points: f.negative_points,
            explanation: f.explanation,
            correct_answer_text: f.correct_answer_text,
            surah_number: f.surah_number,
            ayah_number: f.ayah_number,
            page_number: f.page_number,
            juz_number: f.juz_number,
            hizb_number: f.hizb_number,
            choices: f.choices.map((c) => ({
              id: c.id,
              text: c.text,
              position: c.position,
              is_correct: c.is_correct,
            })),
          });
        } catch {
          // skip questions that can't be read (should not happen for owner)
        }
      }
      setQuiz({
        ...competition,
        default_points: competition.default_points,
        default_negative_points: competition.default_negative_points,
        question_count: full.length,
        participant_count: 0,
      });
      setQuestions(full.length ? full : [emptyQuestion(1)]);
      setSelected(0);
      setPreview(false);
      setDirty(false);
      setErrors({});
      try {
        setClasses((await listMyClasses()) ?? []);
      } catch {
        setClasses([]);
      }
      setState("ready");
    } catch (err) {
      console.error("Failed to load quiz:", err);
      setLoadError(err instanceof Error ? err.message : t("editor.loadFailed"));
      setState("error");
    }
  }, [quizId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const defaults = useMemo(
    () => ({
      points: quiz?.default_points ?? 10,
      negative: quiz?.default_negative_points ?? -2,
    }),
    [quiz]
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const changeQuiz = (patch) => {
    setQuiz((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateQuestion = (index, question) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? question : q)));
    setDirty(true);
  };

  const moveQuestion = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((q, i) => ({ ...q, position: i + 1 }));
    });
    setSelected(target);
    setDirty(true);
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)]);
    setSelected(questions.length);
    setPreview(false);
    setDirty(true);
  };

  const removeQuestion = (index) => {
    const question = questions[index];
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, position: i + 1 }));
      setSelected(Math.max(0, index - 1));
      return next;
    });
    if (question?.id) setDeletedIds((prev) => [...prev, question.id]);
    setDirty(true);
  };

  const saveAll = async () => {
    if (!quiz) return;

    const validation = questions.reduce((acc, q, i) => {
      const e = validateQuestion(q, t);
      if (Object.keys(e).length) acc[i] = e;
      return acc;
    }, {});
    setErrors(validation);
    if (Object.keys(validation).length) {
      toast({
        title: t("editor.checkErrors"),
        description: t("editor.checkErrorsDesc"),
        variant: "error",
      });
      setPreview(false);
      return;
    }

    setSaving(true);
    try {
      await updateQuizMeta(quiz.id, {
        name: quiz.name,
        description: quiz.description,
        language: quiz.language,
        category: quiz.category,
        difficulty: quiz.difficulty,
        default_points: quiz.default_points,
        default_negative_points: quiz.default_negative_points,
        speed_bonus_enabled: quiz.speed_bonus_enabled,
        visibility: quiz.visibility,
        class_id: quiz.class_id ?? null,
      });

      for (const id of deletedIds) {
        try {
          await deleteQuestion(id);
        } catch {
          // already gone or owned elsewhere — ignore
        }
      }
      setDeletedIds([]);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
          const id = await saveQuestion({
            competitionId: quiz.id,
            questionId: q.id,
            position: i + 1,
            text: q.text,
            type: q.type,
            durationSeconds: q.duration_seconds,
            points: q.points,
            negativePoints: q.negative_points,
            explanation: q.explanation,
            correctAnswerText: q.correct_answer_text,
            surahNumber: q.surah_number,
            ayahNumber: q.ayah_number,
            pageNumber: q.page_number,
            juzNumber: q.juz_number,
            hizbNumber: q.hizb_number,
            choices: q.choices
              .filter((c) => c.text.trim())
              .map((c, j) => ({ text: c.text, position: j + 1, isCorrect: c.isCorrect })),
          });
          questions[i] = { ...q, id };
        } catch (err) {
          console.error("save failed on question", i + 1, err);
          if (err?.code === "23505") {
            // position collision — renumber everything and retry once
            const revert = questions.map((q) => ({ ...q }));
            for (let k = 0; k < questions.length; k++) {
              const retry = await saveQuestion({
                competitionId: quiz.id,
                questionId: revert[k].id,
                position: k + 1,
                text: revert[k].text,
                type: revert[k].type,
                durationSeconds: revert[k].duration_seconds,
                points: revert[k].points,
                negativePoints: revert[k].negative_points,
                explanation: revert[k].explanation,
                correctAnswerText: revert[k].correct_answer_text,
                surahNumber: revert[k].surah_number,
                ayahNumber: revert[k].ayah_number,
                pageNumber: revert[k].page_number,
                juzNumber: revert[k].juz_number,
                hizbNumber: revert[k].hizb_number,
                choices: revert[k].choices
                  .filter((c) => c.text.trim())
                  .map((c, j) => ({ text: c.text, position: j + 1, isCorrect: c.isCorrect })),
              });
              revert[k] = { ...revert[k], id: retry };
            }
            setQuestions(revert);
          } else {
            throw err;
          }
        }
      }

      setQuestions((prev) => prev.map((q, i) => ({ ...q, position: i + 1 })));
      setDirty(false);
      toast({
        title: t("editor.savedToastTitle"),
        description: t("editor.savedToastDesc"),
        variant: "success",
      });
    } catch (err) {
      console.error("Failed to save quiz:", err);
      toast({
        title: t("editor.saveFailedTitle"),
        description: err instanceof Error ? err.message : t("editor.saveFailed"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const launchGame = async () => {
    if (!quiz || questions.length === 0) return;
    setLaunching(true);
    try {
      await setQuizStatus(quiz.id, "waiting");
      toast({
        title: t("editor.launchToastTitle"),
        description: t("editor.launchToastDesc"),
        variant: "success",
      });
      router.push(`/host/games/${quiz.code}`);
    } catch (err) {
      console.error("Launch failed:", err);
      toast({
        title: t("editor.launchFailedTitle"),
        description: err instanceof Error ? err.message : t("editor.launchFailed"),
        variant: "error",
      });
    } finally {
      setLaunching(false);
      setLaunchOpen(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmptyState icon={<Spinner size={20} />} title={t("editor.loadTitle")} description={loadError}>
        <Button variant="outline" onClick={() => router.push("/host/quizzes")}>
          {t("editor.backToQuizzes")}
        </Button>
        <Button onClick={() => load()}>{t("common.tryAgain")}</Button>
      </EmptyState>
    );
  }

  const current = questions[selected];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" href="/host/quizzes">
            ← {t("nav.myQuizzes")}
          </Button>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            {quiz?.name || t("editor.untitledQuiz")}
          </h1>
          {dirty && <Badge variant="warning">{t("editor.unsaved")}</Badge>}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => load()} disabled={saving}>
              {t("editor.discard")}
            </Button>
          )}
          {isDraft ? (
            <Button
              variant="secondary"
              loading={launching}
              onClick={() => setLaunchOpen(true)}
              disabled={questions.length === 0}
            >
              {questions.length === 0 ? t("editor.addQuestionsFirst") : t("editor.launchGame")}
            </Button>
          ) : (
            <Badge variant="success" dot>
              {t("editor.launched")}
            </Badge>
          )}
          <Button loading={saving} onClick={saveAll} disabled={!dirty || (!isDraft && quiz?.status !== "waiting")}>
            {t("editor.saveChanges")}
          </Button>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("editor.settings")}</h2>
          <Badge variant="neutral">
            {t("common.code")}: {quiz?.code}
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label={t("editor.quizName")}
            required
            value={quiz?.name ?? ""}
            onChange={(e) => changeQuiz({ name: e.target.value })}
          />
          <Select
            label={t("editor.language")}
            value={quiz?.language ?? "en"}
            onChange={(e) => changeQuiz({ language: e.target.value })}
          >
            <option value="en">English</option>
            <option value="ar">العربية (Arabic)</option>
            <option value="fr">Français (French)</option>
          </Select>
          <Input
            label={t("editor.category")}
            value={quiz?.category ?? ""}
            onChange={(e) => changeQuiz({ category: e.target.value || null })}
          />
          <Select
            label={t("editor.difficulty")}
            value={quiz?.difficulty ?? ""}
            onChange={(e) => changeQuiz({ difficulty: e.target.value || null })}
          >
            <option value="">{t("editor.difficultyAny")}</option>
            <option value="easy">{t("editor.difficultyEasy")}</option>
            <option value="medium">{t("editor.difficultyMedium")}</option>
            <option value="hard">{t("editor.difficultyHard")}</option>
          </Select>
          <Input
            label={t("editor.defaultPoints")}
            type="number"
            min={0}
            value={quiz?.default_points ?? 10}
            onChange={(e) => changeQuiz({ default_points: Math.max(0, Number(e.target.value) || 0) })}
          />
          <Input
            label={t("editor.defaultNegativePoints")}
            type="number"
            max={0}
            value={quiz?.default_negative_points ?? -2}
            onChange={(e) =>
              changeQuiz({ default_negative_points: Math.min(0, Number(e.target.value) || 0) })
            }
          />
          <Select
            label={t("editor.classOptional")}
            value={quiz?.class_id ?? ""}
            onChange={(e) => changeQuiz({ class_id: e.target.value || null })}
          >
            <option value="">{t("editor.noClass")}</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label={t("editor.description")}
          rows={2}
          value={quiz?.description ?? ""}
          onChange={(e) => changeQuiz({ description: e.target.value || null })}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={quiz?.speed_bonus_enabled ?? false}
            onChange={(e) => changeQuiz({ speed_bonus_enabled: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          {t("editor.speedBonus")}
        </label>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">
          {t("editor.questions")} <span className="text-ink-muted">({questions.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview((v) => !v)} disabled={!current}>
            {preview ? t("editor.backToEditing") : t("editor.preview")}
          </Button>
          <Button size="sm" onClick={addQuestion}>
            {t("editor.addQuestion")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {questions.map((question, index) => (
            <button
              type="button"
              key={question.id ?? `new-${index}`}
              onClick={() => {
                setSelected(index);
                setPreview(false);
              }}
              aria-current={index === selected ? "page" : undefined}
              className={`block w-full rounded-lg border p-3 text-start transition-colors ${
                index === selected
                  ? "border-primary bg-primary-soft/40"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {index + 1}. {question.text || t("editor.untitledQuestion")}
                </span>
                {errors[index] && <Badge variant="danger">{t("editor.incomplete")}</Badge>}
              </div>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {typeLabel(question.type)} · {question.duration_seconds}s ·{" "}
                {question.points ?? defaults.points} {t("common.points")}
              </span>
            </button>
          ))}
        </div>

        <div>
          {preview && current ? (
            <QuestionPreview question={current} defaults={defaults} />
          ) : current ? (
            <QuestionForm
              key={current.id ?? `new-${current.position}-${selected}`}
              question={current}
              defaults={defaults}
              errors={errors[selected] ?? {}}
              onChange={(q) => updateQuestion(selected, q)}
              onDelete={() => removeQuestion(selected)}
              onMove={(delta) => moveQuestion(selected, delta)}
              canMoveUp={selected > 0}
              canMoveDown={selected < questions.length - 1}
            />
          ) : null}
        </div>
      </div>

      <Dialog
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        size="sm"
        title={t("editor.launchDialogTitle")}
        description={`${t("editor.launchDialogDesc")} ${quiz?.code}. ${t("editor.launchDialogLocked")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLaunchOpen(false)} disabled={launching}>
              {t("editor.launchDialogKeep")}
            </Button>
            <Button loading={launching} onClick={launchGame}>
              {t("editor.launchDialogConfirm")}
            </Button>
          </>
        }
      />
    </div>
  );
}

export default QuizEditor;