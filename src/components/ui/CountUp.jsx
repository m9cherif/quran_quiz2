"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CountUp — rolls a number to its new value instead of snapping.
 * Used for scores and totals, where the movement is the point: a student
 * watching their score climb reads it as a reward, not a re-render.
 */
export default function CountUp({ value = 0, duration = 700, className }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      fromRef.current = to;
      setShown(to);
      return;
    }

    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      // Ease-out: quick off the mark, gentle landing.
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{shown.toLocaleString()}</span>;
}
