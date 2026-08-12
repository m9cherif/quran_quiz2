"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";
import { duplicateQuiz, getQuiz, listMyLiveGames, setQuizStatus } from "@/services/quizzes";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * MyGames — live games owned by this host (non-draft competitions).
 * The control room opens from here; launching a draft happens from the
 * quiz editor (Phase 7).
 */
export default function MyGames() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);
  const [replaying, setReplaying] = useState(null);
  const router = useRouter();

  const statusBadge = (status) => {
    const map = {
      waiting: { variant: "info", label: t("host.gameBadgeWaiting") },
      running: { variant: "success", label: t("host.gameBadgeRunning") },
      paused: { variant: "warning", label: t("host.gameBadgePaused") },
      finished: { variant: "neutral", label: t("host.gameBadgeFinished") },
      cancelled: { variant: "neutral", label: t("host.gameBadgeCancelled") },
    };
    return map[status] ?? { variant: "neutral", label: status };
  };

  useEffect(() => {
    let cancelled = false;
    listMyLiveGames()
      .then((items) => {
        if (!cancelled) setGames(items);
      })
      .catch((err) => {
        console.error("Failed to load live games:", err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Run the same quiz again as a brand new game: the finished one keeps its
   * results, and the copy gets a fresh code and an empty lobby.
   */
  const playAgain = async (game) => {
    setReplaying(game.id);
    try {
      const newId = await duplicateQuiz(game.id);
      await setQuizStatus(newId, "waiting");
      const fresh = await getQuiz(newId);
      toast({ title: t("host.playAgainReady"), variant: "success" });
      router.push(`/host/games/${fresh?.code ?? ""}`);
    } catch (err) {
      console.error("Play again failed:", err);
      toast({ title: t("host.playAgainFailed"), description: t("common.tryAgain"), variant: "error" });
      setReplaying(null);
    }
  };

  const cancel = async (game) => {
    try {
      await setQuizStatus(game.id, "cancelled");
      setGames((prev) => (prev ?? []).map((g) => (g.id === game.id ? { ...g, status: "cancelled" } : g)));
      toast({
        title: t("host.cancelledToastTitle"),
        description: `${game.name} ${t("host.cancelledToastDesc")}`,
        variant: "info",
      });
    } catch (err) {
      console.error("Cancel failed:", err);
      toast({ title: t("host.cancelFailed"), description: t("common.tryAgain"), variant: "error" });
    }
  };

  if (error) {
    return (
      <Card>
        <EmptyState title={t("host.loadFailedTitle")} description={t("host.loadFailedDesc")}>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (games === null) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("host.myGamesTitle")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("host.myGamesSub")}</p>
        </div>
        <Button href="/host/quizzes" icon="book">{t("host.browseQuizzes")}</Button>
      </div>

      {games.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title={t("common.noGamesYet")}
            description={t("host.noGamesDesc")}
          >
            <Button href="/host/quizzes" icon="book">{t("host.browseQuizzes")}</Button>
          </EmptyState>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {games.map((game) => {
            const statusInfo = statusBadge(game.status);
            return (
            <li key={game.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-sm font-semibold text-ink-muted">
                  {game.code.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{game.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral">
                      {t("common.code")} {game.code}
                    </Badge>
                    <Badge variant={statusInfo.variant} dot>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(game.status === "finished" || game.status === "cancelled") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    loading={replaying === game.id}
                    onClick={() => playAgain(game)}
                  >
                    {t("host.playAgain")}
                  </Button>
                )}
                {(game.status === "waiting" || game.status === "paused" || game.status === "running") && (
                  <Button variant="ghost" size="sm" onClick={() => cancel(game)}>
                    {t("host.cancel")}
                  </Button>
                )}
                <Button size="sm" href={`/host/games/${game.code}`} icon="settings">
                  {t("host.openControlRoom")}
                </Button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}