"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { audioUrl, loadTimeline } from "@/lib/quran/recitation";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * RecitationReplay — a single "hear this page" button for the moment a page
 * question is over. No page render of its own: the exercise is already on
 * screen, this only supplies the voice, starting at the page's own offset
 * inside the surah recording (which is what the timeline is for).
 */
export default function RecitationReplay({ page, className = "" }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const [timeline, setTimeline] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (page == null) return;
    let active = true;
    loadTimeline(page).then((data) => active && setTimeline(data));
    return () => {
      active = false;
    };
  }, [page]);

  if (!timeline?.audio) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    const ms = el.currentTime * 1000;
    if (ms < timeline.start || (timeline.duration && ms > timeline.start + timeline.duration)) {
      el.currentTime = timeline.start / 1000;
    }
    el.play().catch(() => {});
  };

  return (
    <div className={className}>
      <audio
        ref={audioRef}
        src={audioUrl(timeline.audio)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (!timeline.duration) return;
          if (e.currentTarget.currentTime * 1000 >= timeline.start + timeline.duration) {
            e.currentTarget.pause();
          }
        }}
      />
      <Button variant="outline" className="w-full" onClick={toggle} icon={playing ? "pause" : "play"}>
        {playing ? t("recite.pause") : t("replay.hearPage")}
      </Button>
    </div>
  );
}
