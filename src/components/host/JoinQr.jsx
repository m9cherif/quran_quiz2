"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * JoinQr — scannable join link for the room code.
 * The encoder is imported lazily: it is only ever needed on the host control
 * room, so it must not sit in the shared client bundle. The QR stays on a
 * white plate in both themes — inverted codes scan poorly.
 */
export function JoinQr({ value, size = 160, className }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!value) return;
    let active = true;
    setFailed(false);

    import("qrcode")
      .then((mod) =>
        (mod.default ?? mod).toDataURL(value, {
          width: size * 2, // 2x for crisp rendering on retina screens
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172aff", light: "#ffffffff" },
        })
      )
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-white p-2",
        className
      )}
      style={{ width: size + 20, height: size + 20 }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="" width={size} height={size} className="block" />
      ) : (
        <span className="block animate-pulse rounded bg-slate-200" style={{ width: size, height: size }} />
      )}
    </div>
  );
}

export default JoinQr;
