"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cleanUser } from "@/store/Slices/userSlice";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AccentPicker from "@/components/ui/AccentPicker";
import SoundToggle from "@/components/ui/SoundToggle";

const NAV = {
  public: [
    { href: "/", labelKey: "nav.home" },
    { href: "/practice", labelKey: "nav.practice" },
    { href: "/about", labelKey: "nav.about" },
  ],
  host: [
    { href: "/host/quizzes", labelKey: "nav.myQuizzes" },
    { href: "/host/competitions", labelKey: "nav.liveGames" },
    { href: "/host/classes", labelKey: "nav.classes" },
    { href: "/host/analytics", labelKey: "nav.analytics" },
    { href: "/host/timeline", labelKey: "nav.timeline" },
    { href: "/host/quizzes/new", labelKey: "nav.newQuiz" },
  ],
  student: [
    { href: "/student/dashboard", labelKey: "nav.dashboard" },
    { href: "/student/history", labelKey: "nav.history" },
    { href: "/student/classes", labelKey: "nav.classes" },
    { href: "/join", labelKey: "nav.joinGame" },
  ],
};

/**
 * AppHeader — slim, token-based header for public/host/student layouts.
 */
export function AppHeader({ variant = "public" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const user = useSelector((state) => state.user.user);

  const links = NAV[variant] ?? NAV.public;

  const logout = async () => {
    try {
      await signOut();
    } finally {
      dispatch(cleanUser());
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={variant === "public" ? "/" : "/"} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Quran Quiz Platform" className="h-10 w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.main")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-primary-soft text-primary"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AccentPicker className="me-1" />
          <SoundToggle />
          <ThemeToggle />
          <LocaleSwitcher className="me-1" />
          {variant === "public" && (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                {t("nav.logIn")}
              </Link>
              <Link
                href="/join"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
              >
                {t("nav.joinGame")}
              </Link>
            </>
          )}
          {variant !== "public" && user && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                {variant === "host" ? t("nav.host") : user.name}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                {t("nav.signOut")}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={t("nav.toggle")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-3 md:hidden"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            {open ? (
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            ) : (
              <path
                fillRule="evenodd"
                d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label={t("nav.mobile")}
          className="border-t border-border bg-surface px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            <li className="flex items-center justify-end gap-2 pb-1">
              <ThemeToggle />
              <LocaleSwitcher />
            </li>
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-primary-soft text-primary"
                      : "text-ink-muted hover:bg-surface-3 hover:text-ink"
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
            {variant === "public" && (
              <li className="mt-2 flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  {t("nav.logIn")}
                </Link>
                <Link
                  href="/join"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-strong"
                >
                  {t("nav.joinGame")}
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

export default AppHeader;