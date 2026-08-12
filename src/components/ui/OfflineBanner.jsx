"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * OfflineBanner — says so when the network drops.
 * A live quiz silently failing to submit looks like the app is broken; this
 * makes the real cause obvious, and confirms briefly when the link is back.
 */
export default function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) setOffline(true);

    const goOffline = () => {
      setOffline(true);
      setJustBack(false);
    };
    const goOnline = () => {
      setOffline(false);
      setJustBack(true);
      setTimeout(() => setJustBack(false), 3000);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline && !justBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[95] px-4 py-2 text-center text-sm font-medium text-white ${
        offline ? "bg-danger" : "bg-success"
      }`}
    >
      {offline ? t("net.offline") : t("net.back")}
    </div>
  );
}
