"use client";

import React from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  text: "h-4 rounded",
  circle: "rounded-full",
  rect: "rounded-md",
};

/**
 * Skeleton — loading placeholder. Set size via className (e.g. "w-40 h-8").
 *
 *   <Skeleton className="h-40 w-full" />
 *   <Skeleton variant="circle" className="h-10 w-10" />
 */
export function Skeleton({ variant = "text", className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse bg-surface-3",
        VARIANTS[variant],
        className
      )}
    />
  );
}

export default Skeleton;