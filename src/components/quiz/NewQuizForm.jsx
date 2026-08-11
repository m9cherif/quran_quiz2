"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { createQuiz } from "@/services/quizzes";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * NewQuizForm — minimal metadata for a fresh quiz; the full editor opens
 * right after creation. Everything lives as a draft until launched.
 */
export function NewQuizForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("editor.quizNameRequired"));
      return;
    }
    setError("");
    setCreating(true);
    try {
      const quiz = await createQuiz({
        name: name.trim(),
        description: description.trim() || null,
        language,
        category: category.trim() || null,
        difficulty: difficulty || null,
      });
      toast({
        title: t("editor.quizCreated"),
        description: t("editor.quizCreatedDesc"),
        variant: "success",
      });
      router.push(`/host/quizzes/${quiz.id}/edit`);
    } catch (err) {
      console.error("Create quiz failed:", err);
      setError(err instanceof Error ? err.message : t("editor.createFailed"));
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-2xl font-bold text-ink">{t("editor.createQuiz")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("editor.createSub")}</p>

      <Card padding="lg" className="mt-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Input
            label={t("editor.quizName")}
            required
            placeholder={t("editor.quizNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
          />
          <Textarea
            label={t("editor.description")}
            rows={2}
            placeholder={t("editor.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label={t("editor.language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
            </Select>
            <Input
              label={t("editor.category")}
              placeholder={t("editor.categoryPlaceholder")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Select
              label={t("editor.difficulty")}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">{t("editor.difficultyAny")}</option>
              <option value="easy">{t("editor.difficultyEasy")}</option>
              <option value="medium">{t("editor.difficultyMedium")}</option>
              <option value="hard">{t("editor.difficultyHard")}</option>
            </Select>
          </div>
          <Button type="submit" loading={creating} className="w-full" size="lg">
            {t("editor.createAndAdd")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default NewQuizForm;