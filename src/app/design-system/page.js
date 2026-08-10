"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

function Section({ title, children }) {
  return (
    <section className="border-b border-border pb-8">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const ICONS = {
  quiz: (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm3 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H8Zm0 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z" />
    </svg>
  ),
};

export default function DesignSystemPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorValue, setErrorValue] = useState("");

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-ink">Design System</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tokens, core components, and states — used for QA of the UI kit.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="Enter your name"
            required
            hint="Between 2 and 50 characters"
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errorValue}
            onChange={(e) => setErrorValue(e.target.value)}
          />
          {errorValue && (
            <p className="text-xs text-ink-muted">
              Typing in the email field toggles its error state.
            </p>
          )}
          <Select label="Difficulty" defaultValue="easy">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Textarea label="Question text" rows={3} placeholder="Type the question…" />
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success" dot>
            Running
          </Badge>
          <Badge variant="warning" dot>
            Draft
          </Badge>
          <Badge variant="danger">Cancelled</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </Section>

      <Section title="Cards & skeleton">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="font-medium text-ink">Quiz card</p>
            <p className="mt-1 text-sm text-ink-muted">
              A Card provides the standard surface for lists, forms, and dashboards.
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-sm text-ink-muted">Loading state</p>
            <div className="mt-3 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" variant="rect" />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState
            icon={ICONS.quiz}
            title="No quizzes yet"
            description="Create your first quiz to start hosting live games with your students."
          >
            <Button size="sm" href="/">
              Create quiz
            </Button>
          </EmptyState>
        </Card>
      </Section>

      <Section title="Dialog">
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          Open confirmation dialog
        </Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Delete this quiz?"
          description="This will permanently remove the quiz and its questions. This action cannot be undone."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDialogOpen(false);
                  toast({
                    title: "Deleted",
                    description: "The quiz and its questions were removed.",
                    variant: "success",
                  });
                }}
              >
                Delete quiz
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">
            Students who already joined a live game from this quiz are not affected.
          </p>
        </Dialog>
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toast({ title: "Saved", description: "Quiz saved successfully.", variant: "success" })}
          >
            Success toast
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({ title: "Failed", description: "Could not reach the server.", variant: "error" })
            }
          >
            Error toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast({ title: "Heads up", description: "Time is almost up.", variant: "warning" })}
          >
            Warning toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast({ title: "Info", description: "3 students joined the game.", variant: "info" })}
          >
            Info toast
          </Button>
        </div>
      </Section>
    </main>
  );
}