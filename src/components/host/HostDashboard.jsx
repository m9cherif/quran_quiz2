"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { updateQuizMeta } from "@/services/quizzes";

/**
 * HostDashboard — first thing a host sees when a game opens its lobby.
 * Sets the game title, optional instructions shown to students, and the
 * per-question time limit (minutes). Writes straight to the competition.
 */
export default function HostDashboard({ game }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [title, setTitle] = useState(game.title ?? game.name);
  const [instructions, setInstructions] = useState(game.instructions ?? "");
  const [minutes, setMinutes] = useState(game.minutes_per_question ?? 1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateQuizMeta(game.id, {
        title: title.trim() || game.name,
        instructions: instructions.trim() || null,
        minutes_per_question: Math.min(60, Math.max(1, Number(minutes) || 1)),
      });
      toast({ title: t("host.setupSaved"), variant: "success" });
    } catch (err) {
      console.error("Failed to save game setup:", err);
      toast({
        title: t("host.setupSaveFailed"),
        description: err instanceof Error ? err.message : t("common.tryAgain"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{t("host.setupTitle")}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("host.setupTagline")}</p>
      </div>

      <Input
        label={t("host.setupGameTitle")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("host.setupGameTitlePlaceholder")}
        maxLength={120}
      />

      <Textarea
        label={t("host.setupInstructions")}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={t("host.setupInstructionsPlaceholder")}
        rows={3}
        maxLength={500}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Input
            label={t("host.setupMinutesPerQuestion")}
            type="number"
            min={1}
            max={60}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <p className="pb-2.5 text-sm text-ink-muted">{t("host.setupMinutesHint")}</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => {
          setTitle(game.title ?? game.name);
          setInstructions(game.instructions ?? "");
          setMinutes(game.minutes_per_question ?? 1);
        }}>
          {t("common.reset")}
        </Button>
        <Button loading={saving} onClick={save} icon="check">
          {t("host.setupSave")}
        </Button>
      </div>
    </Card>
  );
}