"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  AVAILABLE_PAGES,
  pageImageUrl,
  regionFromPoints,
  regionStyle,
  sortRegions,
} from "@/lib/quran/pages";

/**
 * PageWordsEditor — the authoring half of the "mots cachés" exercise
 * (exercices.py). The host picks a page, drags boxes over the words that
 * should be masked, and types the word inside each box. Boxes are stored
 * normalised, so the same annotation works at any screen width.
 *
 * The PyQt version read boxes from an annotation .xlsx per page; here the host
 * marks them directly on the image, which removes the external data dependency.
 */
export default function PageWordsEditor({ question, onChange }) {
  const { t } = useI18n();
  const imgRef = useRef(null);
  const [draft, setDraft] = useState(null); // in-progress drag, normalised
  const [selected, setSelected] = useState(0);

  const page = question.page_number ?? AVAILABLE_PAGES[0];
  const regions = question.regions ?? [];
  const words = question.words ?? [];
  const imageUrl = pageImageUrl(page);

  const set = (patch) => onChange({ ...question, ...patch });

  const pointOf = (event) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const p = pointOf(event);
    if (!p) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraft({ ax: p.x, ay: p.y, bx: p.x, by: p.y });
  };

  const onPointerMove = (event) => {
    if (!draft) return;
    const p = pointOf(event);
    if (!p) return;
    setDraft((prev) => (prev ? { ...prev, bx: p.x, by: p.y } : prev));
  };

  const onPointerUp = () => {
    if (!draft) return;
    const region = regionFromPoints(draft.ax, draft.ay, draft.bx, draft.by);
    setDraft(null);
    if (!region) return;
    const nextRegions = sortRegions([...regions, region]);
    // Keep each word attached to its box across the re-sort.
    const keyed = regions.map((r, i) => [r, words[i] ?? ""]);
    keyed.push([region, ""]);
    const nextWords = nextRegions.map((r) => {
      const hit = keyed.find(([k]) => k.x1 === r.x1 && k.y1 === r.y1 && k.x2 === r.x2);
      return hit ? hit[1] : "";
    });
    set({ regions: nextRegions, words: nextWords });
    setSelected(nextRegions.indexOf(region));
  };

  const removeRegion = (index) => {
    set({
      regions: regions.filter((_, i) => i !== index),
      words: words.filter((_, i) => i !== index),
    });
    setSelected((prev) => Math.max(0, prev > index ? prev - 1 : prev));
  };

  const setWord = (index, text) =>
    set({ words: words.map((w, i) => (i === index ? text : w)) });

  const missing = regions.length === 0 || words.some((w) => !String(w ?? "").trim());

  return (
    <Card className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label={t("pw.pageLabel")}
          value={String(page)}
          onChange={(e) => set({ page_number: Number(e.target.value) })}
        >
          {AVAILABLE_PAGES.map((p) => (
            <option key={p} value={p}>
              {t("pw.pageOption", { page: p })}
            </option>
          ))}
        </Select>
        <Input
          label={t("editor.duration")}
          type="number"
          min={10}
          max={600}
          value={question.duration_seconds ?? 120}
          onChange={(e) =>
            set({ duration_seconds: Math.max(10, Number(e.target.value) || 120) })
          }
        />
        <Input
          label={t("editor.pointsPerQuestion")}
          type="number"
          min={0}
          value={question.points ?? ""}
          onChange={(e) =>
            set({ points: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">{t("pw.drawHint")}</p>
          <Badge variant={missing ? "warning" : "success"}>
            {t("pw.boxCount", { count: regions.length })}
          </Badge>
        </div>

        <div
          className="relative select-none overflow-hidden rounded-lg border border-border bg-white"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDraft(null)}
          style={{ touchAction: "none", cursor: "crosshair" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={t("pw.pageOption", { page })}
            className="block w-full"
            draggable={false}
          />

          {regions.map((region, i) => (
            <span
              key={`${region.x1}-${region.y1}-${i}`}
              className={`absolute border-2 ${
                i === selected ? "border-primary bg-primary/25" : "border-emerald-500 bg-emerald-400/15"
              }`}
              style={regionStyle(region)}
            >
              <span className="absolute -top-2 -end-2 rounded-full bg-slate-900 px-1.5 text-[10px] font-bold text-white">
                {i + 1}
              </span>
            </span>
          ))}

          {draft && (
            <span
              className="absolute border-2 border-dashed border-primary bg-primary/20"
              style={regionStyle(
                regionFromPoints(draft.ax, draft.ay, draft.bx, draft.by) ?? {
                  x1: draft.ax,
                  y1: draft.ay,
                  x2: draft.bx,
                  y2: draft.by,
                }
              )}
            />
          )}
        </div>
      </div>

      {regions.length > 0 && (
        <ol className="space-y-2">
          {regions.map((region, i) => (
            <li key={`w-${i}`} className="flex items-end gap-2">
              <span className="mb-2.5 w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1" onFocus={() => setSelected(i)}>
                <Input
                  label={i === 0 ? t("pw.wordLabel") : undefined}
                  dir="rtl"
                  value={words[i] ?? ""}
                  placeholder={t("pw.wordPlaceholder")}
                  onChange={(e) => setWord(i, e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5 text-danger"
                onClick={() => removeRegion(i)}
                aria-label={t("pw.removeBox", { n: i + 1 })}
              >
                ×
              </Button>
            </li>
          ))}
        </ol>
      )}

      {missing && <p className="text-sm text-warning-strong">{t("pw.incomplete")}</p>}
    </Card>
  );
}
