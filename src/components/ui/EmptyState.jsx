"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * EmptyState — explains "nothing here" and what to do next.
 *
 *   <EmptyState
 *     icon={<i aria-hidden="true" />}
 *     title="No quizzes yet"
 *     description="Create your first quiz to start hosting live games."
 *   >
 *     <Button>Create quiz</Button>
 *   </EmptyState>
 */
export function EmptyState({ icon, title, description, children, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {children && <div className="mt-3 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export default EmptyState;