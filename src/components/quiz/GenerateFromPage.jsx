"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { AVAILABLE_PAGES, loadAnnotationIndex, loadPageAnnotations, pageImageUrl } from "@/lib/quran/pages";
import { loadTimeline, loadTimelineIndex } from "@/lib/quran/recitation";
import { generateQuestions } from "@/lib/quran/generate";
import { useI18n } from "@/lib/i18n/I18nProvider";

const KINDS = [
  { id: "hidden_words", labelKey: "gen.kindHidden" },
  { id: "continue", labelKey: "gen.kindContinue" },
  { id: "listen", labelKey: "gen.kindListen" },
];

/**
 * GenerateFromPage — turn a page of published data into a set of questions.
 * Hidden-word exercises come from the annotation boxes, "what comes next"
 * from the ayah text, and listening questions from the recitation timeline.
 */
export default function GenerateFromPage({ open, onClose, onGenerate }) {
  const { t } = useI18n();
  const [page, setPage] = useState(AVAILABLE_PAGES[0]);
  const [count, setCount] = useState(3);
  const [wordsPer, setWordsPer] = useState(6);
  const [kinds, setKinds] = useState(["hidden_words"]);
  const [annotated, setAnnotated] = useState({});
  const [recited, setRecited] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnnotationIndex().then(setAnnotated).catch(() => {});
    loadTimelineIndex().then(setRecited).catch(() => {});
  }, []);

  const hasWords = Boolean(annotated[String(page)]);
  const hasAudio = Boolean(recited[String(page)]);

  const toggleKind = (id) =>
    setKinds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const [words, timeline] = await Promise.all([
        loadPageAnnotations(page),
        hasAudio ? loadTimeline(page) : Promise.resolve(null),
      ]);
      if (words.length === 0) {
        setError(t("gen.noData"));
        return;
      }

      // Boxes are in the page image's pixel space, so the real size is needed
      // before anything can be normalised.
      const size = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = pageImageUrl(page);
      });
      if (!size.width) {
        setError(t("gen.noImage"));
        return;
      }

      const generated = generateQuestions({
        page,
        words,
        imageWidth: size.width,
        imageHeight: size.height,
        timeline,
        kinds,
        count: Math.max(1, Math.min(10, Number(count) || 1)),
        wordsPerExercise: Math.max(2, Math.min(20, Number(wordsPer) || 6)),
      });

      if (generated.length === 0) {
        setError(t("gen.nothing"));
        return;
      }
      onGenerate(generated);
      onClose();
    } catch (err) {
      console.error("Generate failed:", err);
      setError(t("common.tryAgain"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t("gen.title")}
      description={t("gen.desc")}
      footer={
        <>
          <Button variant="ghost" icon="close" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button icon="bolt" onClick={run} loading={busy} disabled={kinds.length === 0}>
            {t("gen.run")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label={t("pw.pageLabel")}
            value={String(page)}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {AVAILABLE_PAGES.map((n) => (
              <option key={n} value={n}>
                {t("pw.pageOption", { page: n })}
                {recited[String(n)] ? " ♪" : ""}
              </option>
            ))}
          </Select>
          <Input
            label={t("gen.count")}
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <Input
            label={t("gen.wordsPer")}
            type="number"
            min={2}
            max={20}
            value={wordsPer}
            onChange={(e) => setWordsPer(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => {
            const disabled = kind.id === "listen" && !hasAudio;
            return (
              <button
                key={kind.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleKind(kind.id)}
                aria-pressed={kinds.includes(kind.id)}
                className={`press rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                  kinds.includes(kind.id)
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-ink-muted"
                }`}
              >
                {t(kind.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={hasWords ? "success" : "warning"}>
            {hasWords ? t("gen.hasWords", { count: annotated[String(page)] }) : t("gen.noWords")}
          </Badge>
          <Badge variant={hasAudio ? "success" : "neutral"}>
            {hasAudio ? t("gen.hasAudio") : t("gen.noAudio")}
          </Badge>
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
