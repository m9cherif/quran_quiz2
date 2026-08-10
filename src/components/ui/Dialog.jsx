"use client";

import React, { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog — accessible modal.
 *
 *   const [open, setOpen] = useState(false);
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Delete quiz?">
 *     Are you sure? This cannot be undone.
 *   </Dialog>
 *
 * Features: focus trap, Escape to close, backdrop click to close (configurable),
 * focus restore on close, body scroll lock, aria-modal semantics.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panel.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    panel?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-[dialog-fade_150ms_ease-out]"
        onClick={closeOnBackdrop ? () => closeRef.current() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? `${titleId}-desc` : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-lg border border-border bg-surface p-5 shadow-dialog outline-none",
          "animate-[dialog-in_150ms_ease-out]",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-lg",
          size === "xl" && "max-w-2xl",
          className
        )}
      >
        {title && (
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
        )}
        {description && (
          <p id={`${titleId}-desc`} className="mt-1 text-sm text-ink-muted">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
        {footer && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default Dialog;