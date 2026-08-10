"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import {
  archiveClass,
  createClass,
  listClassMembers,
  listMyClasses,
  removeClassMember,
} from "@/services/classes";

function copyCode(code, toast) {
  navigator.clipboard?.writeText(code).then(
    () => toast({ title: "Code copied", description: `Class code ${code}.`, variant: "info" }),
    () => toast({ title: "Couldn't copy", description: "Select the code manually.", variant: "error" })
  );
}

/**
 * HostClasses — create/archive classes, share join codes, manage members.
 * Students join with the code from /student/classes; quizzes can be assigned
 * to a class from the quiz editor.
 */
export default function HostClasses() {
  const { toast } = useToast();
  const [classes, setClasses] = useState(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [membersClass, setMembersClass] = useState(null);
  const [members, setMembers] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(() => {
    listMyClasses()
      .then((items) => setClasses(items ?? []))
      .catch((err) => {
        console.error("Failed to load classes:", err);
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!membersClass) {
      setMembers(null);
      return;
    }
    let cancelled = false;
    listClassMembers(membersClass.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows ?? []);
      })
      .catch((err) => {
        console.error("Failed to load members:", err);
        if (!cancelled) {
          setMembers([]);
          toast({ title: "Couldn't load members", description: "Try again.", variant: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [membersClass, toast]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createClass(name, description || null);
      toast({ title: "Class created", description: "Share the code with your students.", variant: "success" });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      console.error("Create class failed:", err);
      toast({
        title: "Couldn't create the class",
        description: "Check the name and try again.",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  const removeMember = async (profileId) => {
    if (!membersClass) return;
    try {
      await removeClassMember(membersClass.id, profileId);
      setMembers((prev) => (prev ?? []).filter((m) => m.profile_id !== profileId));
      load();
      toast({ title: "Member removed", variant: "info" });
    } catch (err) {
      console.error("Remove member failed:", err);
      toast({ title: "Couldn't remove the member", variant: "error" });
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveClass(archiveTarget.id);
      toast({ title: "Class archived", description: "Students can no longer join it.", variant: "info" });
      setArchiveTarget(null);
      load();
    } catch (err) {
      console.error("Archive class failed:", err);
      toast({ title: "Couldn't archive the class", variant: "error" });
    } finally {
      setArchiving(false);
    }
  };

  if (failed) {
    return (
      <Card>
        <EmptyState title="Couldn't load your classes" description="Check your connection and try again.">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (classes === null) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Classes</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Group your students, share a code, and assign quizzes to a class.
          </p>
        </div>
        <Button href="/host/analytics">Analytics</Button>
      </div>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg font-semibold text-ink">Create a class</h2>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Class name"
              placeholder="e.g. Quran Group A"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Description (optional)"
              placeholder="e.g. Second period, beginners"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" loading={creating} disabled={name.trim().length < 2}>
            Create class
          </Button>
        </form>
      </Card>

      {classes.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title="No classes yet"
            description="Create your first class and share its code with students."
          />
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {classes.map((cls) => (
            <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">{cls.name}</p>
                  {cls.archived_at && <Badge variant="neutral">Archived</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {cls.description || "No description"} · {cls.member_count} member
                  {cls.member_count === 1 ? "" : "s"} · {cls.game_count} game
                  {cls.game_count === 1 ? "" : "s"}
                </p>
                <button
                  type="button"
                  onClick={() => copyCode(cls.code, toast)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-primary transition-colors hover:bg-surface-3"
                  title="Copy class code"
                >
                  {cls.code}
                  <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 11.5v-8Z" />
                    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h.75v9.25c0 .83.67 1.5 1.5 1.5h5.75v.75A1.5 1.5 0 0 1 11.5 18h-6A1.5 1.5 0 0 1 4 16.5v-10Z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMembersClass(cls)}>
                  Members
                </Button>
                {!cls.archived_at && (
                  <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(cls)}>
                    Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={membersClass !== null}
        onClose={() => setMembersClass(null)}
        title={membersClass ? `Members — ${membersClass.name}` : "Members"}
        description={`Code ${membersClass?.code ?? ""}. Students join from their classes page.`}
        footer={
          <Button variant="ghost" onClick={() => setMembersClass(null)}>
            Close
          </Button>
        }
      >
        {members === null ? (
          <div className="space-y-3 py-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            className="py-4"
            title="No members yet"
            description="Share the class code for students to join."
          />
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-ink-muted">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(m.profile_id)}
                  aria-label={`Remove ${m.name}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archive this class?"
        description={`${archiveTarget?.name ?? ""} will stop accepting new members. Existing assignments stay.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)}>
              Keep class
            </Button>
            <Button variant="danger" loading={archiving} onClick={confirmArchive}>
              Archive class
            </Button>
          </>
        }
      />
    </div>
  );
}