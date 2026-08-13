"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { pageImageUrl, regionStyle } from "@/lib/quran/pages";
import { getHostQuestionFull, listParticipants, listQuestionAnswers } from "@/services/games";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * One student's attempt at a page exercise, drawn on the page itself.
 *
 * Green outline where they put the right word, red with what they wrote (and
 * what belonged there) where they did not, and a dashed box for one they never
 * filled. Marking a page exercise from a list of indices is unreadable; on the
 * page it takes a glance.
 */
function AnswerSheet({ question, chips, solution, answerText }) {
  const { t } = useI18n();
  const regions = Array.isArray(question.regions) ? question.regions : [];
  const truth = String(solution ?? "").split("|").map(Number);
  const given = String(answerText ?? "").split("|").map(Number);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pageImageUrl(question.page_number)} alt="" className="block w-full" />
      {regions.map((region, i) => {
        const placed = Number.isFinite(given[i]) && given[i] >= 0 ? given[i] : null;
        const wanted = Number.isFinite(truth[i]) ? truth[i] : null;
        const right = placed !== null && placed === wanted;

        return (
          <span
            key={`ans-${i}`}
            title={
              right
                ? chips[wanted]?.text
                : `${t("answers.wrote")}: ${placed !== null ? chips[placed]?.text : "—"} · ${t(
                    "answers.expected"
                  )}: ${wanted !== null ? chips[wanted]?.text : "—"}`
            }
            className={`absolute flex items-center justify-center overflow-hidden rounded text-[10px] font-semibold leading-tight ${
              right
                ? "border-2 border-emerald-500 bg-emerald-500/10"
                : placed === null
                  ? "border-2 border-dashed border-slate-400 bg-white/70"
                  : "border-2 border-rose-500 bg-rose-100 text-rose-900"
            }`}
            style={regionStyle(region)}
          >
            <span dir="rtl" className="px-0.5">
              {right ? "" : placed !== null ? chips[placed]?.text : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * StudentAnswers — what every player actually answered for one question.
 * Page exercises get a marked-up page each; everything else is listed as text.
 */
export default function StudentAnswers({ open, onClose, competitionId, question }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [full, setFull] = useState(null);

  useEffect(() => {
    if (!open || !question) return;
    let active = true;
    setRows(null);
    setFull(null);

    Promise.all([
      listQuestionAnswers(competitionId, question.id),
      listParticipants(competitionId),
      // The owner-only read carries the answer key and the chip list.
      getHostQuestionFull(question.id).catch(() => null),
    ])
      .then(([answers, players, questionFull]) => {
        if (!active) return;
        const byId = new Map(players.map((p) => [p.id, p]));
        setRows(
          answers
            .map((a) => ({ ...a, player: byId.get(a.participant_id) }))
            .sort((a, b) =>
              (a.player?.display_name ?? "").localeCompare(b.player?.display_name ?? "")
            )
        );
        setFull(questionFull);
      })
      .catch((err) => {
        console.error("Could not load answers:", err);
        if (active) setRows([]);
      });

    return () => {
      active = false;
    };
  }, [open, competitionId, question]);

  const isPage = question?.type === "page_words";
  const chips = full?.choices ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={t("answers.title")}
      description={t("answers.desc")}
      footer={
        <Button variant="ghost" icon="close" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{t("answers.none")}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {row.player?.avatar && <span className="me-1.5">{row.player.avatar}</span>}
                  {row.player?.display_name ?? t("call.student")}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={row.is_correct ? "success" : "danger"}>
                    {row.is_correct ? t("answers.correct") : t("answers.incorrect")}
                  </Badge>
                  <Badge variant="neutral">
                    {Math.round((row.points ?? 0) + (row.bonus_points ?? 0))} {t("common.points")}
                  </Badge>
                  <Badge variant="neutral">
                    {((row.response_time_ms ?? 0) / 1000).toFixed(1)}s
                  </Badge>
                </span>
              </div>

              {isPage && full ? (
                <AnswerSheet
                  question={question}
                  chips={chips}
                  solution={full.correct_answer_text}
                  answerText={row.answer_text}
                />
              ) : (
                <p className="text-sm text-ink" dir="auto">
                  {row.answer_text ||
                    chips.find((c) => c.id === row.choice_id)?.text ||
                    t("answers.blank")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
