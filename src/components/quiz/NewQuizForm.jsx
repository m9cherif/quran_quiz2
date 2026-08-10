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

/**
 * NewQuizForm — minimal metadata for a fresh quiz; the full editor opens
 * right after creation. Everything lives as a draft until launched.
 */
export function NewQuizForm() {
  const router = useRouter();
  const { toast } = useToast();

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
      setError("Give your quiz a name first.");
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
      toast({ title: "Quiz created", description: "Now add your questions.", variant: "success" });
      router.push(`/host/quizzes/${quiz.id}/edit`);
    } catch (err) {
      console.error("Create quiz failed:", err);
      setError(err instanceof Error ? err.message : "Could not create the quiz.");
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-2xl font-bold text-ink">Create a quiz</h1>
      <p className="mt-1 text-sm text-ink-muted">
        You'll add questions right after — the quiz stays a draft until you launch it live.
      </p>

      <Card padding="lg" className="mt-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Input
            label="Quiz name"
            required
            placeholder="e.g. Surah Al-Baqarah Basics"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error || undefined}
          />
          <Textarea
            label="Description (optional)"
            rows={2}
            placeholder="What is this quiz about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
            </Select>
            <Input
              label="Category"
              placeholder="general"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Select
              label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          <Button type="submit" loading={creating} className="w-full" size="lg">
            Create and add questions
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default NewQuizForm;