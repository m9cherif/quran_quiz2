"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { setParticipant } from "@/store/Slices/participantSlice";
import {
  joinClass,
  joinClassGame,
  leaveClass,
  listClassGames,
  myClasses,
} from "@/services/classes";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * StudentClasses — join a class with the host's code and see the classes
 * you belong to. Joining links your account to the class, so the games your
 * teacher assigns to that class show in your history.
 */
export default function StudentClasses() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [classes, setClasses] = useState(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [gamesFor, setGamesFor] = useState(null);
  const [games, setGames] = useState(null);
  const [entering, setEntering] = useState(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const [joinError, setJoinError] = useState("");

  const load = useCallback(() => {
    myClasses()
      .then((rows) => setClasses(rows ?? []))
      .catch((err) => {
        console.error("Failed to load my classes:", err);
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError("");
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,10}$/.test(trimmed)) {
      setJoinError(t("student.classCodeError"));
      return;
    }
    setJoining(true);
    try {
      await joinClass(trimmed);
      toast({
        title: t("student.classJoined"),
        description: t("student.classJoinedDesc"),
        variant: "success",
      });
      setCode("");
      load();
    } catch (err) {
      console.error("Join class failed:", err);
      if (err?.code === "28000") {
        setJoinError(t("student.classNotOpen"));
      } else {
        toast({
          title: t("student.classJoinFailed"),
          description: t("common.tryAgain"),
          variant: "error",
        });
      }
    } finally {
      setJoining(false);
    }
  };

  /** Games this class has run — no code needed, membership is the invitation. */
  const openGames = (cls) => {
    setGamesFor(cls);
    setGames(null);
    listClassGames(cls.id)
      .then(setGames)
      .catch((err) => {
        console.error("Class games failed:", err);
        setGames([]);
      });
  };

  const enterGame = async (game) => {
    setEntering(game.id);
    try {
      const participant = await joinClassGame(game.id, user?.name || t("call.student"));
      dispatch(
        setParticipant({
          id: participant.id,
          competitionId: participant.competition_id,
          displayName: participant.display_name,
          accessToken: participant.access_token,
          code: game.code,
          joinedAt: participant.joined_at,
        })
      );
      router.push(`/live/${game.code}`);
    } catch (err) {
      console.error("Enter class game failed:", err);
      toast({
        title: t("classGames.enterFailed"),
        description: err?.message || t("common.tryAgain"),
        variant: "error",
      });
      setEntering(null);
    }
  };

  const leave = async (cls) => {
    try {
      await leaveClass(cls.id);
      setClasses((prev) => (prev ?? []).filter((c) => c.id !== cls.id));
      toast({
        title: t("student.classLeft"),
        description: t("student.classLeftDesc", { name: cls.name }),
        variant: "info",
      });
    } catch (err) {
      console.error("Leave class failed:", err);
      toast({ title: t("student.classLeaveFailed"), variant: "error" });
    }
  };

  if (failed) {
    return (
      <Card>
        <EmptyState
          title={t("student.classesLoadFailed")}
          description={t("common.loadFailedDesc")}
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (classes === null) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("student.myClasses")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("student.myClassesSub")}</p>
        </div>
        <Button href="/join" icon="users">{t("nav.joinGame")}</Button>
      </div>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg font-semibold text-ink">{t("student.joinClass")}</h2>
        <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={t("student.classCode")}
              placeholder={t("student.classCodePlaceholder")}
              required
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={10}
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                )
              }
              error={joinError || undefined}
            />
          </div>
          <Button type="submit" loading={joining} disabled={code.trim().length < 3} icon="plus">
            {t("student.joinClassButton")}
          </Button>
        </form>
      </Card>

      <Dialog
        open={gamesFor !== null}
        onClose={() => setGamesFor(null)}
        size="lg"
        title={gamesFor ? `${t("classGames.title")} — ${gamesFor.name}` : t("classGames.title")}
        description={t("classGames.desc")}
        footer={
          <Button variant="ghost" icon="close" onClick={() => setGamesFor(null)}>
            {t("common.close")}
          </Button>
        }
      >
        {games === null ? (
          <Skeleton className="h-24 w-full" />
        ) : games.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("classGames.none")}</p>
        ) : (
          <ul className="stagger space-y-2">
            {games.map((game) => {
              const live = ["waiting", "running", "paused"].includes(game.status);
              return (
                <li
                  key={game.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {game.title || game.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {new Date(game.created_at).toLocaleDateString()} · {game.code}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={live ? "success" : "neutral"}>
                      {live ? t("classGames.live") : t("common.finished")}
                    </Badge>
                    {live ? (
                      // The host can close class entry; someone already in
                      // keeps their way back regardless.
                      game.class_can_join === false && !game.already_joined ? (
                        <Badge variant="neutral">{t("classGames.closed")}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          icon="play"
                          loading={entering === game.id}
                          onClick={() => enterGame(game)}
                        >
                          {game.already_joined ? t("classGames.rejoin") : t("classGames.enter")}
                        </Button>
                      )
                    ) : (
                      <Button size="sm" variant="outline" icon="chart" href={`/live/${game.code}/result`}>
                        {t("classGames.results")}
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>

      {classes.length === 0 ? (
        <Card className="mt-6">
          <EmptyState title={t("student.noClassesTitle")} description={t("student.noClassesDesc")} />
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {classes.map((cls) => (
            <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{cls.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {cls.description || `${t("common.code")} ${cls.code}`} · {cls.member_count}{" "}
                  {t("student.members")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" icon="play" onClick={() => openGames(cls)}>
                  {t("classGames.open")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => leave(cls)}>
                  {t("common.leave")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}