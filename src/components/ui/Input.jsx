"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Input — labelled text/number/email/password field with error + hint support.
 *
 *   <Input label="Name" error="Name is required" hint="Between 2 and 50 chars" />
 *
 * Pass { label } to render an associated label; { error } renders an
 * aria-invalid input + message. Props are forwarded to the native input.
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    required = false,
    className,
    id: idProp,
    ...props
  },
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
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "block h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink",
          "placeholder:text-ink-faint",
          "transition-colors duration-[var(--duration-fast)]",
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

export default Input;