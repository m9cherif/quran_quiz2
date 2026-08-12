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
  getQuiz,
  getQuizQuestionsFull,
  saveOrderingQuestion,
  savePageWordsQuestion,
  saveQuestion,
  setQuizStatus,
  updateQuizMeta,
} from "@/services/quizzes";
import { downloadTextFile, slugify } from "@/lib/export";
import { printQuizSheet } from "@/lib/printSheet";
import GenerateFromPage from "./GenerateFromPage";
import { AVAILABLE_PAGES } from "@/lib/quran/pages";
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
      page_words: t("editor.typePageWords"),
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
  const [savedAt, setSavedAt] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  /**
   * Paste a whole set at once: one question per line, options separated by
   * "|", the correct one marked with a trailing "*". A line with no options
   * becomes a free-text question whose answer is the first field after the
   * question mark — the fastest path from a worksheet to a quiz.
   */
  const applyBulk = () => {
    const parsed = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
        const [text, ...rest] = parts;
        if (!text) return null;

        if (rest.length === 0) return null;
        if (rest.length === 1) {
          // "question | answer" — a typed answer, not a choice list.
          return {
            ...emptyQuestion(1),
            type: "text",
            text,
            correct_answer_text: rest[0].replace(/\*$/, "").trim(),
            choices: [],
          };
        }
        const choices = rest.map((option, i) => ({
          id: null,
          text: option.replace(/\*$/, "").trim(),
          position: i + 1,
          isCorrect: option.endsWith("*"),
        }));
        // No marker means the first option is treated as the answer.
        if (!choices.some((c) => c.isCorrect)) choices[0].isCorrect = true;
        return { ...emptyQuestion(1), type: "mcq", text, choices };
      })
      .filter(Boolean);

    if (parsed.length === 0) {
      toast({ title: t("bulk.nothingParsed"), variant: "error" });
      return;
    }

    setQuestions((prev) => {
      const base = prev.filter((q) => q.text.trim() || q.id);
      return [...base, ...parsed].map((q, i) => ({ ...q, position: i + 1 }));
    });
    setDirty(true);
    setBulkOpen(false);
    setBulkText("");
    toast({ title: t("bulk.added", { count: parsed.length }), variant: "success" });
  };
  const [questionFilter, setQuestionFilter] = useState("");

  const isDraft = quiz?.status === "draft";
  // save_question accepts edits until a question actually starts, so the
  // editor stays usable for a lobby that is open and for a live game.
  const canEdit = ["draft", "waiting", "running", "paused"].includes(quiz?.status);

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
      // One owner-scoped call for the whole deck (was one RPC per question).
      const rows = await getQuizQuestionsFull(quizId);
      const full = rows.map((f) => ({
        // page_words: rebuild "word per box" from the stored solution
        // (solution[i] = index of the chip that belongs in box i).
        ...(f.type === "page_words"
          ? {
              regions: Array.isArray(f.regions) ? f.regions : [],
              words: String(f.correct_answer_text ?? "")
                .split("|")
                .filter((v) => v !== "")
                .map((chipIndex) => (f.choices ?? [])[Number(chipIndex)]?.text ?? ""),
            }
          : { regions: [], words: [] }),
        // ordering: the same trick — solution[i] is the display index of the
        // fragment that belongs at slot i, so it rebuilds the authored order.
        items:
          f.type === "ordering"
            ? String(f.correct_answer_text ?? "")
                .split("|")
                .filter((v) => v !== "")
                .map((idx) => (f.choices ?? [])[Number(idx)]?.text ?? "")
            : ["", ""],
        audio_url: f.audio_url ?? null,
        hint: f.hint ?? null,
        id: f.id,
        position: f.position,
        text: f.text,
        type: f.type,
        duration_seconds: f.duration_seconds,
        points: f.points,
        negative_points: f.negative_points,
        explanation: f.explanation,
        correct_answer_text: f.correct_answer_text,
        // Locked once its window has opened — the DB refuses edits and
        // rewriting the choices would orphan answers already submitted.
        started: Boolean(f.started_at),
        surah_number: f.surah_number,
        ayah_number: f.ayah_number,
        page_number: f.page_number,
        juz_number: f.juz_number,
        hizb_number: f.hizb_number,
        // The form and the validator both read `isCorrect`; the RPC returns
        // `is_correct`. Mapping it through is what makes an existing MCQ show
        // its correct option (and stops "pick a correct answer" on save).
        choices: (f.choices ?? []).map((c) => ({
          id: c.id,
          text: c.text,
          position: c.position,
          isCorrect: Boolean(c.is_correct),
        })),
      }));
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
    // A question that already ran keeps its slot in the transcript.
    if (questions[index]?.started || questions[target]?.started) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((q, i) => ({ ...q, position: i + 1 }));
    });
    setSelected(target);
    setDirty(true);
  };

  /** Copy a question in place — faster than retyping a near-identical one. */
  const duplicateQuestion = (index) => {
    const source = questions[index];
    if (!source) return;
    const copy = {
      ...source,
      id: null, // a new row, not an edit of the original
      started: false,
      choices: (source.choices ?? []).map((c) => ({ ...c, id: null })),
      items: [...(source.items ?? [])],
      regions: [...(source.regions ?? [])],
      words: [...(source.words ?? [])],
    };
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next.map((q, i) => ({ ...q, position: i + 1 }));
    });
    setSelected(index + 1);
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
    if (question?.started) {
      toast({ title: t("editor.questionLocked"), variant: "warning" });
      return;
    }
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

      // Work on a copy: mutating the state array in place made React skip the
      // re-render that surfaces the ids the RPC just handed back.
      const saved = questions.map((q, i) => ({ ...q, position: i + 1 }));

      const persist = (q, position) =>
        q.type === "ordering"
          ? saveOrderingQuestion({
              competitionId: quiz.id,
              questionId: q.id,
              position,
              text: q.text,
              items: (q.items ?? []).map((i) => String(i ?? "").trim()).filter(Boolean),
              durationSeconds: q.duration_seconds ?? 60,
              points: q.points,
              negativePoints: q.negative_points,
              explanation: q.explanation,
              hint: q.hint ?? null,
              surahNumber: q.surah_number,
              ayahNumber: q.ayah_number,
            })
          : q.type === "page_words"
          ? savePageWordsQuestion({
              competitionId: quiz.id,
              questionId: q.id,
              position,
              pageNumber: q.page_number ?? AVAILABLE_PAGES[0],
              durationSeconds: q.duration_seconds ?? 120,
              points: q.points,
              negativePoints: q.negative_points,
              explanation: q.explanation,
              surahNumber: q.surah_number,
              ayahNumber: q.ayah_number,
              juzNumber: q.juz_number,
              hizbNumber: q.hizb_number,
              regions: q.regions ?? [],
              words: (q.words ?? []).map((text, i) => ({ text, region: i })),
            })
          : saveQuestion({
          competitionId: quiz.id,
          questionId: q.id,
          position,
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
            .map((c, j) => ({ text: c.text, position: j + 1, is_correct: Boolean(c.isCorrect) })),
          audioUrl: q.audio_url ?? null,
          hint: q.hint ?? null,
        });

      for (let i = 0; i < saved.length; i++) {
        // Questions that already ran are immutable server-side; leave them be.
        if (saved[i].started) continue;
        try {
          saved[i] = { ...saved[i], id: await persist(saved[i], i + 1) };
        } catch (err) {
          console.error("save failed on question", i + 1, err);
          if (err?.code !== "23505") throw err;
          // Position collision with a row still holding that slot: park every
          // unsaved question beyond the end, then lay them down in order.
          const offset = saved.length + 100;
          for (let k = 0; k < saved.length; k++) {
            if (saved[k].started || !saved[k].id) continue;
            await persist(saved[k], offset + k);
          }
          for (let k = 0; k < saved.length; k++) {
            if (saved[k].started) continue;
            saved[k] = { ...saved[k], id: await persist(saved[k], k + 1) };
          }
          break;
        }
      }

      setQuestions(saved);
      setDirty(false);
      setSavedAt(new Date());
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

  /** Paper fallback: the questions plus a separate answer key. */
  const printSheet = () => {
    if (!quiz) return;
    printQuizSheet(quiz, questions, {
      answerKey: t("editor.answerKey"),
      question: t("editor.questions"),
      points: t("common.points"),
      seconds: t("editor.seconds"),
      hint: t("editor.hintLabel"),
      noAnswer: t("editor.noAnswerSet"),
      printedFrom: t("editor.printedFrom"),
    });
  };

  /** Download the quiz as JSON — re-importable from the library. */
  const exportQuiz = () => {
    if (!quiz) return;
    const payload = {
      name: quiz.name,
      description: quiz.description ?? null,
      language: quiz.language ?? "en",
      category: quiz.category ?? null,
      difficulty: quiz.difficulty ?? null,
      default_points: quiz.default_points ?? 10,
      default_negative_points: quiz.default_negative_points ?? -2,
      speed_bonus_enabled: Boolean(quiz.speed_bonus_enabled),
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type,
        duration_seconds: q.duration_seconds,
        points: q.points,
        negative_points: q.negative_points,
        explanation: q.explanation,
        correct_answer_text: q.correct_answer_text,
        surah_number: q.surah_number,
        ayah_number: q.ayah_number,
        page_number: q.page_number,
        juz_number: q.juz_number,
        hizb_number: q.hizb_number,
        choices: q.choices
          .filter((c) => c.text.trim())
          .map((c) => ({ text: c.text, is_correct: Boolean(c.isCorrect) })),
      })),
    };
    downloadTextFile(
      `${slugify(quiz.name, "quiz")}.quiz.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    toast({ title: t("editor.exportDone"), variant: "success" });
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
          {dirty ? (
            <Badge variant="warning">{t("editor.unsaved")}</Badge>
          ) : savedAt ? (
            <Badge variant="success">
              {t("editor.savedAt", { time: savedAt.toLocaleTimeString() })}
            </Badge>
          ) : null}
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
          <Button variant="outline" onClick={printSheet} disabled={!quiz} icon="print">
            {t("editor.printSheet")}
          </Button>
          <Button variant="outline" onClick={exportQuiz} disabled={!quiz} icon="download">
            {t("editor.exportJson")}
          </Button>
          <Button loading={saving} onClick={saveAll} disabled={!dirty || !canEdit} icon="check">
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
        <div className="flex flex-wrap items-center gap-2">
          {questions.length > 4 && (
            <input
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value)}
              placeholder={t("editor.filterQuestions")}
              aria-label={t("editor.filterQuestions")}
              className="h-9 w-40 rounded-md border border-border bg-surface px-2 text-sm text-ink"
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setPreview((v) => !v)} disabled={!current}>
            {preview ? t("editor.backToEditing") : t("editor.preview")}
          </Button>
          <Button size="sm" variant="outline" icon="bolt" onClick={() => setGenOpen(true)}>
            {t("gen.open")}
          </Button>
          <Button size="sm" variant="outline" icon="upload" onClick={() => setBulkOpen(true)}>
            {t("bulk.open")}
          </Button>
          <Button size="sm" onClick={addQuestion} icon="plus">
            {t("editor.addQuestion")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {questions.map((question, index) => {
            // Filtering hides rows without renumbering: the index a row edits
            // must stay the index it occupies in the deck.
            const hay = `${index + 1} ${question.text ?? ""} ${question.type}`.toLowerCase();
            if (questionFilter.trim() && !hay.includes(questionFilter.trim().toLowerCase())) {
              return null;
            }
            return (
            <div key={question.id ?? `new-${index}`} className="relative">
            <button
              type="button"
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
                  {index + 1}.{" "}
                  {question.type === "page_words"
                    ? t("pw.pageOption", { page: question.page_number ?? "—" })
                    : question.text || t("editor.untitledQuestion")}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {question.started && <Badge variant="neutral">{t("editor.alreadyPlayed")}</Badge>}
                  {errors[index] && <Badge variant="danger">{t("editor.incomplete")}</Badge>}
                </span>
              </div>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {typeLabel(question.type)} · {question.duration_seconds}s ·{" "}
                {question.points ?? defaults.points} {t("common.points")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => duplicateQuestion(index)}
              title={t("editor.duplicateQuestion")}
              aria-label={t("editor.duplicateQuestion")}
              className="absolute end-2 top-2 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink"
            >
              ⧉
            </button>
            </div>
            );
          })}
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

      <GenerateFromPage
        open={genOpen}
        onClose={() => setGenOpen(false)}
        onGenerate={(generated) => {
          setQuestions((prev) => {
            const base = prev.filter((q) => q.text.trim() || q.id);
            const built = generated.map((g) => ({
              ...emptyQuestion(1),
              type: g.type,
              text: g.text,
              duration_seconds: g.duration_seconds,
              correct_answer_text: g.correct_answer_text,
              audio_url: g.audio_url,
              page_number: g.page_number,
              ayah_number: g.ayah_number,
              regions: g.regions,
              words: g.words,
              choices: [],
            }));
            return [...base, ...built].map((q, i) => ({ ...q, position: i + 1 }));
          });
          setDirty(true);
          toast({ title: t("gen.added", { count: generated.length }), variant: "success" });
        }}
      />

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        size="lg"
        title={t("bulk.title")}
        description={t("bulk.desc")}
        footer={
          <>
            <Button variant="ghost" icon="close" onClick={() => setBulkOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button icon="plus" onClick={applyBulk} disabled={!bulkText.trim()}>
              {t("bulk.add")}
            </Button>
          </>
        }
      >
        <Textarea
          label={t("bulk.label")}
          rows={8}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"ما هي أول سورة؟ | الفاتحة* | البقرة | الناس\n2 + 2 = ? | 4* | 5"}
          hint={t("bulk.hint")}
        />
      </Dialog>

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