"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Textarea — labelled multiline field with error/hint support.
 *
 *   <Textarea label="Question text" rows={4} error="Required" />
 */
const Textarea = forwardRef(function Textarea(
  { label, error, hint, required = false, className, id: idProp, rows = 4, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = cn(error ? errorId : null, hint ? hintId : null) || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
          {required && (
            <span className="ms-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "block w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink",
          "placeholder:text-ink-faint",
          "resize-y transition-colors duration-[var(--duration-fast)]",
          "focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error
            ? "border-danger focus:outline-danger"
            : "border-border hover:border-border-strong",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Textarea;