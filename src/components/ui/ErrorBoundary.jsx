"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * ErrorBoundary — route/segment-level error fallback.
 *
 *   <ErrorBoundary>
 *     <QuizEditor />
 *   </ErrorBoundary>
 *
 * Fallback shows a human message + "Try again" (re-mounts children).
 */
export class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? "" };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.reset, this.state.message);
    }

    const { t } = this.props;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1.5-8.5a1.5 1.5 0 1 0 3 0v-3a1.5 1.5 0 1 0-3 0v3ZM10 14.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-ink">{t("common.errorTitle")}</h2>
        <p className="max-w-sm text-sm text-ink-muted">
          {t("common.errorDesc")}
          {this.state.message && (
            <span className="mt-1 block font-mono text-xs text-ink-faint">
              {this.state.message}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }
}

export function ErrorBoundary(props) {
  const { t } = useI18n();
  return <ErrorBoundaryInner {...props} t={t} />;
}

export default ErrorBoundary;