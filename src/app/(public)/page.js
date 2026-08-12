"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function LandingPage() {
  const { t } = useI18n();

  const roles = [
    {
      href: "/host/games",
      title: t("landing.hostTitle"),
      description: t("landing.hostDescription"),
      icon: (
        <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.5 3.75a1.5 1.5 0 1 0-3 0v1.11a9.18 9.18 0 0 0-.8.3L5.94 3.24a1.5 1.5 0 1 0-2.7 1.32l2.76 1.92a8.94 8.94 0 0 0-.24 6.1l-3.3 3.3a1.5 1.5 0 1 0 2.13 2.12l3.3-3.3a8.94 8.94 0 0 0 6.1-.24l1.93 2.77a1.5 1.5 0 1 0 1.32-2.7l-1.93-2.77a9.17 9.17 0 0 0 .31-.8h1.11a1.5 1.5 0 1 0 0-3h-1.11a9.18 9.18 0 0 0-.3-.8l2.77-1.93a1.5 1.5 0 1 0-1.32-2.7l-2.77 1.93a8.94 8.94 0 0 0-6.1-.24l-1.92-2.77A1.5 1.5 0 0 0 13.5 1.5v2.25Z" />
        </svg>
      ),
      action: t("landing.startHosting"),
    },
    {
      href: "/join",
      title: t("landing.joinTitle"),
      description: t("landing.joinDescription"),
      icon: (
        <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm7.5 9a6.5 6.5 0 0 1 6.35-6.98V7H6.15A6.5 6.5 0 0 1 11.5 15v0Z" />
        </svg>
      ),
      action: t("landing.enterCode"),
    },
  ];

  const steps = [
    { step: "01", title: t("landing.step1Title"), description: t("landing.step1Description") },
    { step: "02", title: t("landing.step2Title"), description: t("landing.step2Description") },
    { step: "03", title: t("landing.step3Title"), description: t("landing.step3Description") },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="animate-rise text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">
          {t("landing.heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/host/games"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
          >
            {t("landing.hostQuiz")}
          </Link>
          <Link
            href="/join"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-6 text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
          >
            {t("landing.joinTitle").toLowerCase()}
          </Link>
        </div>
      </section>

      <section
        aria-label={t("landing.rolesHeading")}
        className="stagger mt-16 grid gap-4 sm:grid-cols-2"
      >
        {roles.map((role) => (
          <Link key={role.href} href={role.href} className="group">
            <Card
              padding="lg"
              animate={false}
              interactive
              className="h-full transition-colors group-hover:border-primary group-hover:bg-surface-2"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {role.icon}
              </div>
              <h2 className="text-lg font-semibold text-ink">{role.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{role.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                {role.action}
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 rtl:rotate-180"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section
        aria-label={t("landing.stepsHeading")}
        className="stagger mt-16 grid gap-6 sm:grid-cols-3"
      >
        {steps.map((s) => (
          <div key={s.step}>
            <p className="text-sm font-semibold text-primary">{s.step}</p>
            <h3 className="mt-2 text-base font-semibold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{s.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}