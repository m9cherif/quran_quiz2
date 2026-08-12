"use client";

/**
 * Sparkline — a tiny trend line for a student's scores over time.
 * Pure SVG, no chart library: a handful of points does not justify one.
 */
export default function Sparkline({ values = [], width = 160, height = 40, className = "" }) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    // Leave 3px of headroom so the stroke is never clipped.
    const y = height - 3 - ((v - min) / span) * (height - 6);
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-hidden="true"
    >
      <path d={area} className={rising ? "fill-success/15" : "fill-danger/15"} />
      <path
        d={line}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? "stroke-success" : "stroke-danger"}
      />
      <circle cx={lastX} cy={lastY} r="3" className={rising ? "fill-success" : "fill-danger"} />
    </svg>
  );
}
