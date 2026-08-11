"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { joinClass, leaveClass, myClasses } from "@/services/classes";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * StudentClasses — join a class with the host's code and see the classes
 * you belong to. Joining links your account to the class, so the games your
 * teacher assigns to that class show in your history.
 */
export default function StudentClasses() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [classes, setClasses] = useState(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const load = useCallback(() => {
    myClasses()
      .then((rows) => setClasses(rows ?? []))
      .catch((err) => {
        console.error("Failed to load my classes:", err);
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError("");
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,10}$/.test(trimmed)) {
      setJoinError(t("student.classCodeError"));
      return;
    }
    setJoining(true);
    try {
      await joinClass(trimmed);
      toast({
        title: t("student.classJoined"),
        description: t("student.classJoinedDesc"),
        variant: "success",
      });
      setCode("");
      load();
    } catch (err) {
      console.error("Join class failed:", err);
      if (err?.code === "28000") {
        setJoinError(t("student.classNotOpen"));
      } else {
        toast({
          title: t("student.classJoinFailed"),
          description: t("common.tryAgain"),
          variant: "error",
        });
      }
    } finally {
      setJoining(false);
    }
  };

  const leave = async (cls) => {
    try {
      await leaveClass(cls.id);
      setClasses((prev) => (prev ?? []).filter((c) => c.id !== cls.id));
      toast({
        title: t("student.classLeft"),
        description: t("student.classLeftDesc", { name: cls.name }),
        variant: "info",
      });
    } catch (err) {
      console.error("Leave class failed:", err);
      toast({ title: t("student.classLeaveFailed"), variant: "error" });
    }
  };

  if (failed) {
    return (
      <Card>
        <EmptyState
          title={t("student.classesLoadFailed")}
          description={t("common.loadFailedDesc")}
        >
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
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("student.myClasses")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("student.myClassesSub")}</p>
        </div>
        <Button href="/join">{t("nav.joinGame")}</Button>
      </div>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg font-semibold text-ink">{t("student.joinClass")}</h2>
        <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={t("student.classCode")}
              placeholder={t("student.classCodePlaceholder")}
              required
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={10}
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                )
              }
              error={joinError || undefined}
            />
          </div>
          <Button type="submit" loading={joining} disabled={code.trim().length < 3}>
            {t("student.joinClassButton")}
          </Button>
        </form>
      </Card>

      {classes.length === 0 ? (
        <Card className="mt-6">
          <EmptyState title={t("student.noClassesTitle")} description={t("student.noClassesDesc")} />
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {classes.map((cls) => (
            <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{cls.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {cls.description || `${t("common.code")} ${cls.code}`} · {cls.member_count}{" "}
                  {t("student.members")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => leave(cls)}>
                {t("common.leave")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}