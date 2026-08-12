"use client";

import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * OrderingEditor — author the fragments in their CORRECT order.
 * The server shuffles them before storing, so what the host types here is the
 * answer key and never the order students see.
 */
export default function OrderingEditor({ question, onChange }) {
  const { t } = useI18n();
  const items = question.items ?? [];
  const set = (patch) => onChange({ ...question, ...patch });

  const update = (index, value) =>
    set({ items: items.map((item, i) => (i === index ? value : item)) });

  const add = () => set({ items: [...items, ""] });

  const remove = (index) => set({ items: items.filter((_, i) => i !== index) });

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    set({ items: next });
  };

  const filled = items.filter((i) => String(i ?? "").trim()).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{t("ord.editorHint")}</p>
        <Badge variant={filled >= 2 ? "success" : "warning"}>
          {t("ord.itemCount", { count: filled })}
        </Badge>
      </div>

      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={`item-${index}`} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">
              {index + 1}
            </span>
            <input
              dir="rtl"
              value={item}
              onChange={(e) => update(index, e.target.value)}
              placeholder={t("ord.itemPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-ink focus:border-primary focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
            />
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={t("editor.moveUp")}
              className="px-1.5 text-sm text-ink-muted disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
              aria-label={t("editor.moveDown")}
              className="px-1.5 text-sm text-ink-muted disabled:opacity-30"
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={t("common.delete")}
              className="px-1.5 text-sm text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <Button variant="outline" size="sm" onClick={add} icon="plus">
        {t("ord.addItem")}
      </Button>
    </div>
  );
}
