"use client";

import { cn } from "@/lib/cn";

/**
 * Countdown — live mm:ss readout of the time left until a server timestamp.
 * Feed it the changing `now` (parent's interval tick) so clients tick in
 * parallel off the same wall clock the students use.
 */
export default function Countdown({ endsAt, now, size = "md", className }) {
  const remaining = Math.max(0, new Date(endsAt).getTime() - now);
  const seconds = Math.ceil(remaining / 1000);
  const m = Math.floor(seconds / 60);
  const label = `${m}:${String(seconds % 60).padStart(2, "0")}`;
  const danger = remaining <= 5000;

  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn(
        "inline-flex items-center rounded-full font-semibold tabular-nums",
        danger ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
        size === "lg" ? "px-4 py-1.5 text-lg" : "px-3 py-1 text-sm",
        className
      )}
    >
      {label}
    </span>
  );
}