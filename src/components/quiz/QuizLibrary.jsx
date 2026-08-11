"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { archiveQuiz, deleteQuiz, duplicateQuiz, listMyQuizzes } from "@/services/quizzes";
import QuizCard from "./QuizCard";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * QuizLibrary — the host's quiz collection: search, duplicate, archive,
 * delete (with confirmation). Drafts are managed here; launching happens
 * from the edit screen (Phase 7).
 */
export function QuizLibrary() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const [state, setState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setLoadError("");
    try {
      const items = await listMyQuizzes();
      setQuizzes(items);
      setState("ready");
    } catch (err) {
      console.error("Failed to load quizzes:", err);
      setLoadError(err instanceof Error ? err.message : t("host.loadFailedDesc"));
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quizzes;
    return quizzes.filter(
      (quiz) =>
        quiz.name.toLowerCase().includes(q) ||
        quiz.code.toLowerCase().includes(q) ||
        (quiz.category ?? "").toLowerCase().includes(q)
    );
  }, [quizzes, query]);

  const duplicate = async (quiz) => {
    setBusy(quiz.id);
    try {
      const id = await duplicateQuiz(quiz.id);
      toast({
        title: t("host.duplicatedTitle"),
        description: t("host.duplicatedDesc"),
        variant: "success",
      });
      router.push(`/host/quizzes/${id}/edit`);
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast({
        title: t("host.duplicateFailed"),
        description: err instanceof Error ? err.message : t("common.tryAgain"),
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuiz(deleteTarget.id);
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== deleteTarget.id));
      toast({
        title: t("host.deletedTitle"),
        description: t("host.deletedDesc", { name: deleteTarget.name }),
        variant: "success",
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete failed:", err);
      toast({
        title: t("host.deleteFailed"),
        description: err instanceof Error ? err.message : t("common.tryAgain"),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const archive = async (quiz) => {
    setBusy(quiz.id);
    try {
      await archiveQuiz(quiz.id);
      setQuizzes((prev) => prev.filter((item) => item.id !== quiz.id));
      toast({
        title: t("host.archivedTitle"),
        description: t("host.archivedDesc"),
        variant: "info",
      });
    } catch (err) {
      console.error("Archive failed:", err);
      toast({ title: t("host.archiveFailed"), description: t("common.tryAgain"), variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmptyState
        icon={<Spinner size={20} />}
        title={t("host.loadFailedTitle")}
        description={loadError}
      >
        <Button onClick={() => load()}>{t("common.tryAgain")}</Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("nav.myQuizzes")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("host.librarySub")}</p>
        </div>
        <Button href="/host/quizzes/new">{t("nav.newQuiz")}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t("host.searchPlaceholder")}
          aria-label={t("host.searchLabel")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-72"
        />
        <Badge variant="neutral">
          {filtered.length} {t("host.of")} {quizzes.length}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={quizzes.length === 0 ? t("host.noQuizzesYet") : t("host.noMatches")}
          description={
            quizzes.length === 0 ? t("host.noQuizzesDesc") : t("host.noMatchesDesc")
          }
        >
          {quizzes.length === 0 && (
            <Button href="/host/quizzes/new">{t("host.createQuiz")}</Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              busy={busy === quiz.id}
              onDuplicate={duplicate}
              onDelete={(target) => {
                if (target.status === "draft") setDeleteTarget(target);
                else archive(target);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={t("host.deleteTitle")}
        description={
          deleteTarget
            ? t("host.deleteDesc", {
                name: deleteTarget.name,
                count: deleteTarget.question_count,
              })
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              {t("host.deletePermanently")}
            </Button>
          </>
        }
      />
    </div>
  );
}

export default QuizLibrary;