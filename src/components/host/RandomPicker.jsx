"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * RandomPicker — "who answers next?" without the teacher being accused of
 * picking favourites. Cycles through the names, slowing down, then lands on
 * one. Motion-reduced users get the result straight away.
 */
export default function RandomPicker({ open, onClose, players }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef(null);

  const stop = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!open) {
      stop();
      setSpinning(false);
      setCurrent(null);
    }
  }, [open]);

  const spin = () => {
    if (players.length === 0) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const winner = players[Math.floor(Math.random() * players.length)];
    if (reduced || players.length === 1) {
      setCurrent(winner);
      playCue("celebrate");
      return;
    }

    setSpinning(true);
    let delay = 60;
    const tick = () => {
      setCurrent(players[Math.floor(Math.random() * players.length)]);
      playCue("tick");
      delay *= 1.18; // ease out until it settles
      if (delay < 420) {
        timerRef.current = setTimeout(tick, delay);
      } else {
        setCurrent(winner);
        setSpinning(false);
        playCue("celebrate");
      }
    };
    tick();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={t("picker.title")}
      description={t("picker.desc")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} icon="close">
            {t("common.close")}
          </Button>
          <Button onClick={spin} loading={spinning} disabled={players.length === 0}>
            {current ? t("picker.again") : t("picker.pick")}
          </Button>
        </>
      }
    >
      <div className="flex min-h-24 items-center justify-center rounded-lg border border-border bg-surface-2 px-4 py-6 text-center">
        {players.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("host.waitingPlayers")}</p>
        ) : (
          <p
            className={`text-2xl font-bold transition-transform ${
              spinning ? "scale-95 text-ink-muted" : "scale-110 text-primary"
            }`}
          >
            {current ?? t("picker.ready")}
          </p>
        )}
      </div>
    </Dialog>
  );
}
