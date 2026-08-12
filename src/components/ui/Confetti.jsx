"use client";

import { useEffect, useRef } from "react";

/**
 * Confetti — a short canvas burst for correct answers and podium finishes.
 * Self-contained (no library), respects prefers-reduced-motion, and removes
 * itself once the pieces fall off screen so nothing keeps painting.
 */
export default function Confetti({ fire, pieces = 90, duration = 2200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fire) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#4f46e5", "#10b981", "#fbbf24", "#f43f5e", "#38bdf8"];
    const parts = Array.from({ length: pieces }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 1.6 + Math.random() * 2.6,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const started = performance.now();
    let raf = 0;

    const frame = (now) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // Fade the last third so the burst ends softly.
        ctx.globalAlpha = elapsed > duration * 0.66 ? Math.max(0, 1 - (elapsed - duration * 0.66) / (duration * 0.34)) : 1;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < duration) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fire, pieces, duration]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
