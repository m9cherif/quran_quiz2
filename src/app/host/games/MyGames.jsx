"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useSelector } from "react-redux";
import API_CONFIG from "@/app/components/API";

/**
 * MyGames — quiz history list (legacy endpoint). Shows games the host can
 * re-open or delete. New Quiz → /host/quizzes/new.
 */
export default function MyGames() {
  const user = useSelector((state) => state.user.user);
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ENDPOINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.getQuizHistory}${user?.user_id}`;

    fetch(ENDPOINT, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!cancelled) setGames(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load quiz history:", err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Couldn't load your games"
          description="Check your connection and try again."
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
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
        <h1 className="text-2xl font-bold text-ink">My games</h1>
        <Button href="/host/quizzes/new">New quiz</Button>
      </div>

      {games.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title="No quiz history yet"
            description="Create your first quiz, then start a live game and share the code with students."
          >
            <Button href="/host/quizzes/new">Create a quiz</Button>
          </EmptyState>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {games.map((game, index) => (
            <li key={game.room_key} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-3 text-sm font-semibold text-ink-muted">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">Game #{game.room_key}</p>
                  <p className="text-xs text-ink-muted">Room key {game.room_key}</p>
                </div>
              </div>
              <Link
                href={`/host/games/${game.room_key}`}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}