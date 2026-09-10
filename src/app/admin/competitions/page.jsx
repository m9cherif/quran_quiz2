"use client";

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { deleteCompetitionAsAdmin, listAllCompetitions } from "@/services/admin";
import { useI18n } from "@/lib/i18n/I18nProvider";

const STATUS_VARIANT = {
  running: "success",
  waiting: "info",
  paused: "warning",
  finished: "neutral",
  cancelled: "danger",
  draft: "neutral",
};

/** Every competition on the platform, across every host. */
export default function AdminCompetitions() {
  const { t } = useI18n();
  const { toast } = useToast();
  const selfId = useSelector((state) => state.user.user?.id);
  const [competitions, setCompetitions] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    listAllCompetitions()
      .then(setCompetitions)
      .catch((err) => {
        console.error("Failed to load competitions:", err);
        toast({ title: t("admin.loadFailed"), variant: "error" });
        setCompetitions([]);
      });
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCompetitionAsAdmin(deleteTarget.id);
      setCompetitions((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast({ title: t("admin.competitionDeleted"), variant: "info" });
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete competition failed:", err);
      toast({ title: t("admin.competitionDeleteFailed"), variant: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">{t("admin.competitionsTitle")}</h1>
      <p className="mt-0.5 text-sm text-ink-muted">{t("admin.competitionsSub")}</p>

      {competitions === null ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {competitions.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.title || t("editor.untitledQuestion")}
                  </p>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"}>{c.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {c.code} · {c.owner_name ?? "—"} · {c.question_count} {t("host.gameWord")} ·{" "}
                  {c.participant_count} {t("host.memberWord")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* The host-side control room checks ownership itself
                    (independent of the admin RLS bypass), so this only
                    works for the admin's own competitions — everyone
                    else's still shows here for moderation, just without
                    a working "open". */}
                {c.owner_id === selfId && (
                  <Button
                    href={`/host/competitions/${encodeURIComponent(c.code)}`}
                    variant="ghost"
                    size="sm"
                  >
                    {t("common.open")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => setDeleteTarget(c)}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("admin.deleteCompetitionTitle")}
        description={`${deleteTarget?.title ?? deleteTarget?.code ?? ""} ${t("admin.deleteCompetitionDesc")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete} icon="trash">
              {t("common.delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}
