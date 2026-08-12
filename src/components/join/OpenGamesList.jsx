"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getSupabase } from "@/lib/supabase/client";
import { listOpenGames } from "@/services/games";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * OpenGamesList — pick a live game instead of typing its code.
 *
 * Kept in step with reality by subscribing to the competitions table: a game
 * opened in another room appears here within a moment, and one that starts or
 * is locked disappears. A student who cannot read the code off a projector at
 * the back of the class can still get in.
 */
export default function OpenGamesList({ onPick, selectedCode }) {
  const { t } = useI18n();
  const [games, setGames] = useState(null);

  const refresh = useCallback(() => {
    listOpenGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    refresh();

    // Any change to a competition can add or remove a joinable game, so the
    // simplest correct reaction is to re-read the (small, indexed) list.
    const channel = getSupabase()
      .channel("open-games")
      .on("postgres_changes", { event: "*", schema: "public", table: "competitions" }, refresh)
      .subscribe();

    // Realtime is hidden from anonymous readers on some rows; poll as a floor.
    const poll = setInterval(refresh, 15000);

    return () => {
      getSupabase().removeChannel(channel);
      clearInterval(poll);
    };
  }, [refresh]);

  if (games === null) {
    return (
      <Card padding="lg" className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  if (games.length === 0) return null;

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{t("openGames.title")}</h2>
        <Badge variant="success" dot>
          {t("openGames.count", { count: games.length })}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{t("openGames.desc")}</p>

      <ul className="stagger mt-4 space-y-2">
        {games.map((game) => {
          const picked = selectedCode === game.code;
          return (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => onPick(game.code)}
                aria-pressed={picked}
                className={`press flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-start transition-colors ${
                  picked
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:border-primary"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {game.title || game.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {[game.category, game.language?.toUpperCase()].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-bold tracking-widest text-primary">
                  {game.code}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
