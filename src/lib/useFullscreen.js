"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fullscreen for the current document.
 * Students get the question without browser chrome on a small phone; the exit
 * is always the Escape key the browser already provides, so nobody gets stuck.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof document !== "undefined" &&
        Boolean(document.documentElement.requestFullscreen)
    );
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return { isFullscreen, supported, toggle };
}

export default useFullscreen;
