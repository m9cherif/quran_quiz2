"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-ink">{t("about.title")}</h1>
      <div className="mt-6 space-y-6 text-base leading-relaxed text-ink-muted">
        <p>{t("about.p1")}</p>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
      </div>
    </div>
  );
}