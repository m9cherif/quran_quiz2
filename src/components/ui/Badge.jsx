"use client";

import React from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  neutral: "bg-surface-3 text-ink-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  info: "bg-info-soft text-info-strong",
};

const DOT_COLORS = {
  neutral: "bg-ink-faint",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/**
 * Badge — small status/label chip.
 *
 *   <Badge variant="success" dot>Running</Badge>
 *   <Badge variant="neutral">Draft</Badge>
 */
export function Badge({ children, variant = "neutral", dot = false, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        // Status changes should catch the eye, not slide in unnoticed.
        "animate-pop",
        VARIANTS[variant],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", DOT_COLORS[variant])}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;