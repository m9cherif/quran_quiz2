"use client";

import React from "react";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

/**
 * Spinner — simple accessible loader.
 *
 * Usage: <Spinner size="md" label="Loading" />
 * `size` accepts "sm" | "md" | "lg" or a px number.
 */
export function Spinner({ size = "md", label = "Loading...", className }) {
  const px = typeof size === "number" ? size : SIZES[size] ?? SIZES.md;

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex shrink-0", className)}
    >
      <svg
        className="animate-spin"
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default Spinner;