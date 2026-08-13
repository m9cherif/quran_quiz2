"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import RecitationPlayer from "@/components/quran/RecitationPlayer";
import ReciteAndFill from "@/components/quran/ReciteAndFill";
import AyahDictation from "@/components/quran/AyahDictation";
import { loadPageAnnotations } from "@/lib/quran/pages";
import { loadTimelineIndex } from "@/lib/quran/recitation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cyclePageState, getPageStates } from "@/lib/quran/progress";

/**
 * PracticeBrowser — listen to a page and follow the words, on your own.
 * No game, no host, no account: the memorisation drill that the rest of the
 * platform is built around, available by itself.
 */
export default function PracticeBrowser() {
  const { t } = useI18n();
  const [pages, setPages] = useState(null);
  const [page, setPage] = useState(null);
  const [words, setWords] = useState([]);
  const [playlist, setPlaylist] = useState(false);
  const [mode, setMode] = useState("follow");
  const [states, setStates] = useState({});

  useEffect(() => setStates(getPageStates()), []);

  useEffect(() => {
    loadTimelineIndex().then((index) => {
      const available = Object.keys(index)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      setPages(available);
      setPage((current) => current ?? available[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (page == null) return;
    let active = true;
    loadPageAnnotations(page).then((list) => {
      if (active) setWords(list);
    });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("recite.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("recite.subtitle")}</p>
      </div>

      {pages === null ? (
        <div className="h-10 animate-pulse rounded-md bg-surface-3" />
      ) : pages.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">{t("recite.none")}</p>
        </Card>
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-pressed={page === n}
                className={`press shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === n
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {t("pw.pageOption", { page: n })}
                {states[String(n)] === "known"
                  ? " ✅"
                  : states[String(n)] === "learning"
                    ? " 📖"
                    : ""}
              </button>
            ))}
          </div>

          <Card padding="lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                {t("pw.pageOption", { page })}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* The learner's own note of where they are with this page. */}
                <button
                  type="button"
                  onClick={() => {
                    const next = cyclePageState(page);
                    setStates((prev) => {
                      const copy = { ...prev };
                      if (next) copy[String(page)] = next;
                      else delete copy[String(page)];
                      return copy;
                    });
                  }}
                  className="press rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  {states[String(page)] === "known"
                    ? `✅ ${t("hifz.known")}`
                    : states[String(page)] === "learning"
                      ? `📖 ${t("hifz.learning")}`
                      : t("hifz.mark")}
                </button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={playlist}
                    onChange={(e) => setPlaylist(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {t("recite.playlist")}
                </label>
                <Badge variant="neutral">{t("recite.wordCount", { count: words.length })}</Badge>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ["follow", "recite.modeFollow"],
                ["fill", "recite.modeFill"],
                ["dictation", "recite.modeDictation"],
              ].map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                  className={`press rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {page != null && mode === "fill" && <ReciteAndFill page={page} words={words} />}
            {page != null && mode === "dictation" && <AyahDictation page={page} words={words} />}

            {page != null && mode === "follow" && (
              <RecitationPlayer
                page={page}
                words={words}
                onFinished={() => {
                  if (!playlist) return;
                  const next = pages[pages.indexOf(page) + 1];
                  if (next != null) setPage(next);
                }}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
