"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { getSupabase } from "@/lib/supabase/client";
import { getGameByCode, gameParticipantCount, getMyParticipant, updatePresence } from "@/services/games";
import { removeParticipant } from "@/store/Slices/participantSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import useGamePresence from "@/lib/presence/useGamePresence";

/**
 * GameLobby — student waiting room for a Supabase live game.
 * Realtime on competition status (running → question, finished → result),
 * polling fallback for cancelled games, player-count heartbeat.
 */
export default function GameLobby({ code }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const participant = useSelector((state) => state.participant.Participant);

  const [game, setGame] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const resolvedRef = useRef(false);

  const competitionId = participant?.competitionId ?? null;
  const accessToken = participant?.accessToken ?? null;

  // Keeps the host's player list honest while everyone waits in the lobby.
  useGamePresence(competitionId, {
    participantId: participant?.id,
    name: participant?.displayName,
  });

  const leaveLobby = useCallback(() => {
    dispatch(removeParticipant());
    router.push("/join");
  }, [dispatch, router]);

  useEffect(() => {
    if (!accessToken || !competitionId || resolvedRef.current) return;
    resolvedRef.current = true;

    const bootstrap = async () => {
      try {
        const mine = await getMyParticipant(competitionId, accessToken);
        if (!mine || mine.id !== participant.id) {
          setExpired(true);
          return;
        }
        const current = await getGameByCode(code);
        if (!current || current.id !== competitionId) {
          setExpired(true);
          return;
        }
        setGame(current);
        await updatePresence(competitionId, accessToken);
        setPlayerCount(await gameParticipantCount(competitionId, accessToken));
      } catch (err) {
        console.error("Lobby bootstrap failed:", err);
        setError(t("game.connectError"));
      }
    };
    bootstrap();
  }, [accessToken, competitionId, code, participant.id]);

  useEffect(() => {
    if (!competitionId || !game || expired) return;

    const heartbeat = setInterval(() => {
      updatePresence(competitionId, accessToken).catch(() => {});
      gameParticipantCount(competitionId, accessToken)
        .then(setPlayerCount)
        .catch(() => {});
    }, 6000);
    return () => clearInterval(heartbeat);
  }, [accessToken, competitionId, game, expired]);

  useEffect(() => {
    if (!competitionId || !game || expired) return;

    const redirectByStatus = (status) => {
      if (status === "running") router.push(`/game/${code}/question`);
      else if (status === "finished") router.push(`/game/${code}/result`);
      else if (status === "cancelled") setExpired(true);
    };

    const channel = getSupabase()
      .channel(`lobby-status-${competitionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "competitions",
          filter: `id=eq.${competitionId}`,
        },
        (payload) => {
          const status = payload?.new?.status;
          if (status) {
            setGame((prev) => (prev ? { ...prev, status } : prev));
            redirectByStatus(status);
          }
        }
      )
      .subscribe();

    const poll = setInterval(async () => {
      try {
        const current = await getGameByCode(code);
        if (!current) {
          setExpired(true);
          return;
        }
        setGame((prev) =>
          prev && prev.status === current.status ? prev : current
        );
        redirectByStatus(current.status);
      } catch {
        // transient — realtime remains the fast path
      }
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, game, expired]);

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">{t("game.notAvailableTitle")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("game.notAvailableDesc")}</p>
          <Button href="/join" className="mt-6 w-full" icon="back">
            {t("common.back")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!competitionId || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">{t("game.sessionExpired")}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t("game.notAvailableDesc")}
          </p>
          <Button href="/join" className="mt-6 w-full" icon="users">
            {t("nav.joinGame")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <p className="text-sm font-medium text-ink-muted">{t("common.code")}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-primary">
            {code}
          </p>
          <div className="mt-6 space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-ink">{t("game.connecting")}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4">
      <Card padding="lg" className="w-full max-w-sm text-center">
        <p className="text-sm font-medium text-ink-muted">{game.title}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-primary">
          {code}
        </p>

        {game.instructions && (
          <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink">
            {game.instructions}
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <p className="text-sm font-medium text-ink">{t("game.startingSoon")}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="primary">{participant.displayName || t("game.you")}</Badge>
          <Badge>
            {playerCount > 0
              ? `${playerCount} ${t("game.playerCount")}`
              : t("game.waitingForPlayers")}
          </Badge>
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Card>

      <button
        type="button"
        onClick={leaveLobby}
        className="mt-4 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t("game.leaveLobby")}
      </button>
    </div>
  );
}