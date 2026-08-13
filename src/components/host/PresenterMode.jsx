"use client";

import { useEffect } from "react";
import Badge from "@/components/ui/Badge";
import Countdown from "@/components/ui/Countdown";
import JoinQr from "@/components/host/JoinQr";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * PresenterMode — the projector view.
 * Everything on screen is sized for the back row: the code and QR while the
 * lobby is open, then the running question with its timer, how many have
 * answered, and the live answer spread once the host reveals it.
 * Escape leaves; the host keeps driving the round from the control room.
 */
export default function PresenterMode({
  game,
  question,
  questionCount,
  answeredCount,
  playerCount,
  endsAt,
  now,
  joinUrl,
  distribution,
  showDistribution,
  onClose,
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const lobby = !question;
  const totalVotes = (distribution ?? []).reduce((sum, d) => sum + Number(d.votes ?? 0), 0);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-surface">

      <header className="flex items-center justify-between gap-4 border-b border-border px-8 py-4">
        <h1 className="truncate text-2xl font-bold text-ink">{game?.title || game?.name}</h1>
        <div className="flex items-center gap-3">
          <Badge variant="neutral">
            {playerCount} {t("common.players")}
          </Badge>
          {endsAt && <Countdown endsAt={endsAt} now={now} size="lg" />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            {t("presenter.exit")}
          </button>
        </div>
      </header>

      {lobby ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
          <p className="text-2xl font-medium text-ink-muted">{t("presenter.joinAt")}</p>
          <p className="font-mono text-[10rem] font-black leading-none tracking-[0.15em] text-primary">
            {game?.code}
          </p>
          {joinUrl && <JoinQr value={joinUrl} size={220} />}
          <p className="text-xl text-ink-muted">{joinUrl}</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-10 px-12 py-8">
          <div>
            <p className="text-xl font-medium text-ink-muted">
              {t("host.questionOfCtrl", { position: question.position, total: questionCount })}
            </p>
            <p className="mt-4 text-5xl font-bold leading-snug text-ink" dir="auto">
              {question.type === "page_words" ? t("pw.playTitle") : question.text}
            </p>
          </div>

          {showDistribution && (distribution ?? []).length > 0 ? (
            <ul className="space-y-3">
              {distribution.map((row) => {
                const pct = totalVotes > 0 ? Math.round((Number(row.votes) / totalVotes) * 100) : 0;
                return (
                  <li key={row.choice_id}>
                    <div className="mb-1 flex items-center justify-between text-2xl">
                      <span className="text-ink" dir="auto">
                        {row.choice_text}
                      </span>
                      <span className="font-bold text-ink-muted">
                        {row.votes} · {pct}%
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          row.is_correct ? "bg-success" : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-4xl font-semibold text-primary">
              {t("presenter.answered", { count: answeredCount, total: playerCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
