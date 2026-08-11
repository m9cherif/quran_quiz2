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
import { useI18n } from "@/lib/i18n/I18nProvider";

function copyCode(code, toast, t) {
  navigator.clipboard?.writeText(code).then(
    () =>
      toast({
        title: t("host.codeCopied"),
        description: `${t("host.codeCopiedDesc")} ${code}.`,
        variant: "info",
      }),
    () =>
      toast({
        title: t("host.copyFailed"),
        description: t("host.copyFailedDesc"),
        variant: "error",
      })
  );
}

/**
 * HostClasses — create/archive classes, share join codes, manage members.
 * Students join with the code from /student/classes; quizzes can be assigned
 * to a class from the quiz editor.
 */
export default function HostClasses() {
  const { toast } = useToast();
  const { t } = useI18n();
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
          toast({
            title: t("host.membersLoadFailed"),
            description: t("common.tryAgain"),
            variant: "error",
          });
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
      toast({
        title: t("host.createdToast"),
        description: t("host.createdToastDesc"),
        variant: "success",
      });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      console.error("Create class failed:", err);
      toast({
        title: t("host.createFailed"),
        description: t("host.createFailedDesc"),
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
      toast({ title: t("host.memberRemoved"), variant: "info" });
    } catch (err) {
      console.error("Remove member failed:", err);
      toast({ title: t("host.removeMemberFailed"), variant: "error" });
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveClass(archiveTarget.id);
      toast({
        title: t("host.archivedToast"),
        description: t("host.archivedToastDesc"),
        variant: "info",
      });
      setArchiveTarget(null);
      load();
    } catch (err) {
      console.error("Archive class failed:", err);
      toast({ title: t("host.archiveFailed"), variant: "error" });
    } finally {
      setArchiving(false);
    }
  };

  if (failed) {
    return (
      <Card>
        <EmptyState title={t("host.loadFailedTitle")} description={t("host.loadFailedDesc")}>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
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
          <h1 className="text-2xl font-bold text-ink">{t("host.classesTitle")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("host.classesSub")}</p>
        </div>
        <Button href="/host/analytics">{t("nav.analytics")}</Button>
      </div>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg font-semibold text-ink">{t("host.createClass")}</h2>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={t("host.className")}
              placeholder={t("host.classNamePlaceholder")}
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label={t("host.classDescription")}
              placeholder={t("host.classDescriptionPlaceholder")}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" loading={creating} disabled={name.trim().length < 2}>
            {t("host.createClass")}
          </Button>
        </form>
      </Card>

      {classes.length === 0 ? (
        <Card className="mt-6">
          <EmptyState title={t("host.noClassesYet")} description={t("host.noClassesYetDesc")} />
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {classes.map((cls) => (
            <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">{cls.name}</p>
                  {cls.archived_at && <Badge variant="neutral">{t("host.archivedBadge")}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {cls.description || t("editor.noDescription")} · {cls.member_count}{" "}
                  {t("host.memberWord")} · {cls.game_count} {t("host.gameWord")}
                </p>
                <button
                  type="button"
                  onClick={() => copyCode(cls.code, toast, t)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-primary transition-colors hover:bg-surface-3"
                  title={t("host.copyClassCode")}
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
                  {t("host.membersLabel")}
                </Button>
                {!cls.archived_at && (
                  <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(cls)}>
                    {t("host.archiveLabel")}
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
        title={membersClass ? `${t("host.membersLabel")} — ${membersClass.name}` : t("host.membersLabel")}
        description={`${t("common.code")} ${membersClass?.code ?? ""}. ${t("host.membersJoinHint")}`}
        footer={
          <Button variant="ghost" onClick={() => setMembersClass(null)}>
            {t("common.close")}
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
            title={t("host.noMembers")}
            description={t("host.noMembersDesc")}
          />
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-ink-muted">
                    {t("host.joinedOn")} {new Date(m.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(m.profile_id)}
                  aria-label={`${t("host.removeMember")} ${m.name}`}
                >
                  {t("host.removeMember")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title={t("host.archiveTitle")}
        description={`${archiveTarget?.name ?? ""} ${t("host.archiveDesc")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)}>
              {t("host.keepClass")}
            </Button>
            <Button variant="danger" loading={archiving} onClick={confirmArchive}>
              {t("host.archiveLabel")}
            </Button>
          </>
        }
      />
    </div>
  );
}