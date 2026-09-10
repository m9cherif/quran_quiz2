"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { deleteUserAccount, listAllProfiles, setUserRole } from "@/services/admin";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ROLE_VARIANT = { admin: "danger", host: "info", student: "neutral" };

/** Every account on the platform: change a role, or remove the account entirely. */
export default function AdminUsers() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    listAllProfiles()
      .then(setProfiles)
      .catch((err) => {
        console.error("Failed to load users:", err);
        toast({ title: t("admin.loadFailed"), variant: "error" });
        setProfiles([]);
      });
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (userId, role) => {
    setBusyId(userId);
    try {
      await setUserRole(userId, role);
      setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, role } : p)));
      toast({ title: t("admin.roleUpdated"), variant: "success" });
    } catch (err) {
      console.error("Role change failed:", err);
      toast({
        title: t("admin.roleUpdateFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUserAccount(deleteTarget.id);
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast({ title: t("admin.userDeleted"), variant: "info" });
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete user failed:", err);
      toast({
        title: t("admin.userDeleteFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">{t("admin.usersTitle")}</h1>
      <p className="mt-0.5 text-sm text-ink-muted">{t("admin.usersSub")}</p>

      {profiles === null ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <Badge variant={ROLE_VARIANT[p.role] ?? "neutral"}>
                    {t(`admin.role${p.role.charAt(0).toUpperCase()}${p.role.slice(1)}`)}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{p.email || p.phone || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={t("admin.roleLabel")}
                  value={p.role}
                  disabled={busyId === p.id}
                  onChange={(e) => changeRole(p.id, e.target.value)}
                  className="w-32"
                >
                  <option value="student">{t("admin.roleStudent")}</option>
                  <option value="host">{t("admin.roleHost")}</option>
                  <option value="admin">{t("admin.roleAdmin")}</option>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => setDeleteTarget(p)}
                >
                  {t("admin.deleteUser")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("admin.deleteUserTitle")}
        description={`${deleteTarget?.name ?? ""} ${t("admin.deleteUserDesc")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete} icon="trash">
              {t("admin.deleteUser")}
            </Button>
          </>
        }
      />
    </div>
  );
}
