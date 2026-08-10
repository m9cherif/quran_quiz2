"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Select — labelled native <select> (accessible by default) with error/hint.
 *
 *   <Select label="Difficulty" defaultValue="easy">
 *     <option value="easy">Easy</option>
 *     <option value="hard">Hard</option>
 *   </Select>
 */
const Select = forwardRef(function Select(
  { label, error, hint, required = false, className, id: idProp, children, ...props },
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
      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "block h-10 w-full appearance-none rounded-md border bg-surface px-3 pe-9 text-sm text-ink",
            "cursor-pointer transition-colors duration-[var(--duration-fast)]",
            "focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-danger focus:outline-danger"
              : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
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

export default Select;