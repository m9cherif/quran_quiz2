"use client";

import { pageImageUrl } from "@/lib/quran/pages";

/**
 * PhraseCrop — a small, readable slice of the mushaf page.
 *
 * The point is legibility: a phrase shown inside the whole page is unreadable
 * on a phone, so the page is scaled up and positioned so that just this phrase
 * fills the frame. Padding is added around the box so the words are not
 * clipped at the edges and the line still looks like part of a page.
 *
 * Implemented with background-size/position rather than a cropped <img>: no
 * canvas, no second network request, and the same source image is reused for
 * every option on screen.
 */
export default function PhraseCrop({
  page,
  box,
  imageSize,
  highlight = false,
  padding = 0.02,
  className = "",
}) {
  if (!imageSize?.width || !imageSize?.height || !box) return null;

  // Normalise to 0..1 and pad, keeping inside the page.
  const x1 = Math.max(0, box.x1 / imageSize.width - padding);
  const x2 = Math.min(1, box.x2 / imageSize.width + padding);
  const y1 = Math.max(0, box.y1 / imageSize.height - padding * 1.6);
  const y2 = Math.min(1, box.y2 / imageSize.height + padding * 1.6);

  const cropW = Math.max(0.02, x2 - x1);
  const cropH = Math.max(0.01, y2 - y1);

  // Scale the page so the crop fills the width of the frame.
  const bgSize = `${(1 / cropW) * 100}% auto`;
  // Percentage background-position is relative to (image - container), hence
  // the division by the remaining fraction rather than a plain x1.
  const posX = cropW >= 1 ? 0 : (x1 / (1 - cropW)) * 100;
  const posY = cropH >= 1 ? 0 : (y1 / (1 - cropH)) * 100;

  // Keep the frame's aspect ratio equal to the crop's, in real pixels.
  const aspect = (cropH * imageSize.height) / (cropW * imageSize.width);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-md border bg-white ${
        highlight ? "border-primary ring-2 ring-primary" : "border-border"
      } ${className}`}
      style={{ paddingTop: `${Math.min(60, aspect * 100)}%` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${pageImageUrl(page)})`,
          backgroundSize: bgSize,
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
