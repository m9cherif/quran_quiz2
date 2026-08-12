"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * CommandPalette — Ctrl/Cmd+K jumps anywhere in the host area.
 * Deliberately keyboard-first: a teacher mid-lesson should not have to hunt
 * through menus. Items are matched on a loose substring so "an" finds
 * Analytics.
 */
export default function CommandPalette({ extraItems = [] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(
    () => [
      { id: "quizzes", label: t("nav.myQuizzes"), href: "/host/quizzes" },
      { id: "new", label: t("nav.newQuiz"), href: "/host/quizzes/new" },
      { id: "games", label: t("nav.liveGames"), href: "/host/games" },
      { id: "classes", label: t("nav.classes"), href: "/host/classes" },
      { id: "analytics", label: t("nav.analytics"), href: "/host/analytics" },
      ...extraItems,
    ],
    [t, extraItems]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  if (!open) return null;

  const run = (item) => {
    setOpen(false);
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-dialog"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              run(results[active]);
            }
          }}
          placeholder={t("palette.placeholder")}
          className="h-12 w-full border-b border-border bg-transparent px-4 text-base text-ink outline-none"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-muted">{t("palette.noMatch")}</li>
          )}
          {results.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => run(item)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-start text-sm ${
                  i === active ? "bg-primary-soft text-primary" : "text-ink hover:bg-surface-2"
                }`}
              >
                {item.label}
                {item.hint && <span className="text-xs text-ink-faint">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
