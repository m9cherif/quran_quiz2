"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";

const MIC_ON = <path d="M10 12a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-4.25 4.94V17h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5v-3.06A5 5 0 0 1 5 9a.75.75 0 0 1 1.5 0 3.5 3.5 0 0 0 7 0A.75.75 0 0 1 15 9Z" />;
const MIC_OFF = <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-3.4-3.4A5 5 0 0 0 15 9a.75.75 0 0 0-1.5 0c0 .7-.2 1.34-.57 1.88L12 9.94V5a2 2 0 0 0-3.9-.62L3.28 2.22ZM7 7.06V9a3 3 0 0 0 4.24 2.73L7 7.06Zm3.75 6.88V17h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5v-3.06A5 5 0 0 1 5 9a.75.75 0 0 1 1.5 0 3.5 3.5 0 0 0 4.25 3.42Z" />;
const CAM_ON = <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h7A1.5 1.5 0 0 1 13 6.5v7A1.5 1.5 0 0 1 11.5 15h-7A1.5 1.5 0 0 1 3 13.5v-7Zm11 2.06 3-1.8v6.48l-3-1.8V8.56Z" />;
const CAM_OFF = <path d="M3.28 2.22a.75.75 0 1 0-1.06 1.06l1.03 1.03A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16h7c.3 0 .58-.09.82-.24l3.4 3.4a.75.75 0 0 0 1.06-1.06L3.28 2.22ZM13 8.56l3-1.8v6.48l-1.2-.72V8.56ZM6.2 5h5.3A1.5 1.5 0 0 1 13 6.5v.7L6.2 5Z" />;

function VideoTile({ stream, label, muted = false, self = false, onMute, muteLabel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && stream && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const hasVideo = Boolean(stream?.getVideoTracks?.().some((t) => t.enabled));

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-slate-900">
      <video
        ref={ref}
        autoPlay
        playsInline
        // Never play your own audio back: that is what causes howling feedback.
        muted={self || muted}
        className={`aspect-video w-full bg-slate-900 object-cover ${hasVideo ? "" : "opacity-0"}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-xl font-bold text-white">
            {(label || "?").trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/50 px-2 py-1">
        <span className="truncate text-xs font-medium text-white">{label}</span>
        {onMute && (
          <button
            type="button"
            onClick={onMute}
            className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-white/25"
          >
            {muteLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * CallPanel — the shared voice/camera surface for host and student.
 * Everyone controls their own microphone and camera; the host additionally
 * gets a per-tile mute that asks that device to go quiet.
 */
export default function CallPanel({ call, role, selfLabel, className = "" }) {
  const { t } = useI18n();
  const {
    joined, connecting, micOn, camOn, hasCamera, forcedMute, error,
    peers, localStream, join, leave, toggleMic, toggleCam, muteParticipant,
  } = call;

  if (!joined) {
    return (
      <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{t("call.title")}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{t("call.blurb")}</p>
          </div>
          <Button onClick={join} loading={connecting}>
            {t("call.join")}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error === "denied" ? t("call.denied") : t("call.failed")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">{t("call.title")}</p>
          <Badge variant="success" dot>
            {t("call.live", { count: peers.length + 1 })}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={micOn ? "outline" : "danger"}
            size="sm"
            onClick={toggleMic}
            aria-pressed={micOn}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              {micOn ? MIC_ON : MIC_OFF}
            </svg>
            {micOn ? t("call.micOn") : t("call.micOff")}
          </Button>
          <Button
            variant={camOn ? "outline" : "ghost"}
            size="sm"
            onClick={toggleCam}
            disabled={!hasCamera}
            aria-pressed={camOn}
            title={hasCamera ? undefined : t("call.noCamera")}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              {camOn ? CAM_ON : CAM_OFF}
            </svg>
            {camOn ? t("call.camOn") : t("call.camOff")}
          </Button>
          <Button variant="ghost" size="sm" onClick={leave}>
            {t("call.leave")}
          </Button>
        </div>
      </div>

      {forcedMute && (
        <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-strong" role="status">
          {t("call.mutedByHost")}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <VideoTile stream={localStream} label={`${selfLabel} (${t("call.you")})`} self />
        {peers.map((peer) => (
          <VideoTile
            key={peer.id}
            stream={peer.stream}
            label={peer.name || (peer.role === "host" ? t("nav.host") : t("call.student"))}
            onMute={role === "host" ? () => muteParticipant(peer.id) : undefined}
            muteLabel={t("call.mute")}
          />
        ))}
      </div>

      {peers.length === 0 && (
        <p className="mt-3 text-center text-xs text-ink-muted">{t("call.waiting")}</p>
      )}
    </div>
  );
}
