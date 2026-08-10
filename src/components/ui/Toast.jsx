"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

const VARIANT_STYLES = {
  success: {
    icon: (
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1.5-3.2 4.9-4.9a.75.75 0 1 0-1.06-1.06L9 13.3l-2.34-2.3a.75.75 0 0 0-1.06 1.06l2.9 2.85Z"
        clipRule="evenodd"
      />
    ),
    iconClass: "text-success-strong",
    containerClass: "border-s-success-strong",
    live: "polite",
  },
  error: {
    icon: (
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM11.5 5.5a1.5 1.5 0 1 0-3 0v3a1.5 1.5 0 1 0 3 0v-3ZM10 14.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
    ),
    iconClass: "text-danger-strong",
    containerClass: "border-s-danger-strong",
    live: "assertive",
  },
  warning: {
    icon: (
      <path d="M9.4 2.9a1.25 1.25 0 0 1 2.2 0l6.7 12a1.25 1.25 0 0 1-1.1 1.85H3.8a1.25 1.25 0 0 1-1.1-1.85l6.7-12ZM10 6.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 10 6.5Zm0 6.75a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    ),
    iconClass: "text-warning-strong",
    containerClass: "border-s-warning-strong",
    live: "polite",
  },
  info: {
    icon: (
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm-1.25 3.25a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0v-4.5Z"
        clipRule="evenodd"
      />
    ),
    iconClass: "text-info-strong",
    containerClass: "border-s-info-strong",
    live: "polite",
  },
};

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

/**
 * ToastProvider — wrap at app root. Then:
 *
 *   const { toast } = useToast();
 *   toast({ title: "Saved", description: "Quiz created", variant: "success" });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info", duration = 5000 }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const style = VARIANT_STYLES[t.variant] ?? VARIANT_STYLES.info;
          return (
            <div
              key={t.id}
              role={t.variant === "error" ? "alert" : "status"}
              aria-live={style.live}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border",
                "border-s-4 bg-surface p-4 shadow-pop",
                "animate-[toast-in_150ms_ease-out]",
                style.containerClass
              )}
            >
              <span className={cn("mt-0.5 shrink-0", style.iconClass)}>
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  {style.icon}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                )}
                {t.description && (
                  <p className="mt-0.5 text-sm text-ink-muted">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 rounded p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;