"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/I18nProvider";

const KEYS = [
  ["N / Space", "shortcuts.next"],
  ["P", "shortcuts.pause"],
  ["F", "shortcuts.presenter"],
  ["D", "shortcuts.spread"],
  ["Ctrl / ⌘ + K", "shortcuts.palette"],
  ["?", "shortcuts.help"],
  ["Esc", "shortcuts.escape"],
];

/**
 * ShortcutsHelp — press "?" in the control room. Shortcuts nobody can discover
 * are shortcuts nobody uses.
 */
export default function ShortcutsHelp() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      size="sm"
      title={t("shortcuts.title")}
      description={t("shortcuts.desc")}
      footer={
        <Button variant="ghost" onClick={() => setOpen(false)} icon="close">
          {t("common.close")}
        </Button>
      }
    >
      <dl className="space-y-2">
        {KEYS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <dt className="text-sm text-ink-muted">{t(label)}</dt>
            <dd>
              <kbd className="rounded border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink">
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
