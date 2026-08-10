"use client";

import React from "react";
import { cn } from "@/lib/cn";

const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

/**
 * Card — surface container. Prefer small/medium usage; never giant cards.
 *
 *   <Card padding="md" className="h-full">…</Card>
 */
export function Card({ children, padding = "md", className }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-card",
        PADDINGS[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export default Card;