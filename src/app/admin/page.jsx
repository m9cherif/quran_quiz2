"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { listAllCompetitions, listAllProfiles } from "@/services/admin";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Admin home — counts across the whole platform, and a way into each area. */
export default function AdminOverview() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState(null);
  const [competitions, setCompetitions] = useState(null);

  useEffect(() => {
    listAllProfiles()
      .then(setProfiles)
      .catch((err) => {
        console.error("Failed to load profiles:", err);
        setProfiles([]);
      });
    listAllCompetitions()
      .then(setCompetitions)
      .catch((err) => {
        console.error("Failed to load competitions:", err);
        setCompetitions([]);
      });
  }, []);

  const roleCounts = (profiles ?? []).reduce(
    (acc, p) => ({ ...acc, [p.role]: (acc[p.role] ?? 0) + 1 }),
    {}
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">{t("admin.overviewTitle")}</h1>
      <p className="mt-0.5 text-sm text-ink-muted">{t("admin.overviewSub")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/users">
          <Card padding="lg" className="h-full transition-colors hover:border-primary">
            <p className="text-sm font-medium text-ink-muted">{t("admin.usersTitle")}</p>
            {profiles === null ? (
              <Skeleton className="mt-2 h-9 w-16" />
            ) : (
              <p className="mt-1 text-3xl font-bold text-ink">{profiles.length}</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              {roleCounts.host ?? 0} {t("nav.host")} · {roleCounts.student ?? 0}{" "}
              {t("call.student")} · {roleCounts.admin ?? 0} {t("admin.roleAdmin")}
            </p>
          </Card>
        </Link>
        <Link href="/admin/competitions">
          <Card padding="lg" className="h-full transition-colors hover:border-primary">
            <p className="text-sm font-medium text-ink-muted">{t("admin.competitionsTitle")}</p>
            {competitions === null ? (
              <Skeleton className="mt-2 h-9 w-16" />
            ) : (
              <p className="mt-1 text-3xl font-bold text-ink">{competitions.length}</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">{t("admin.competitionsSub")}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
