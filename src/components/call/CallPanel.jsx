"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { REACTIONS } from "@/components/game/Reactions";

const MIC_ON = <path d="M10 12a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-4.25 4.94V17h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5v-3.06A5 5 0 0 1 5 9a.75.75 0 0 1 1.5 0 3.5 3.5 0 0 0 7 0A.75.75 0 0 1 15 9Z" />;
const MIC_OFF = <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-3.4-3.4A5 5 0 0 0 15 9a.75.75 0 0 0-1.5 0c0 .7-.2 1.34-.57 1.88L12 9.94V5a2 2 0 0 0-3.9-.62L3.28 2.22ZM7 7.06V9a3 3 0 0 0 4.24 2.73L7 7.06Zm3.75 6.88V17h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5v-3.06A5 5 0 0 1 5 9a.75.75 0 0 1 1.5 0 3.5 3.5 0 0 0 4.25 3.42Z" />;
const CAM_ON = <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h7A1.5 1.5 0 0 1 13 6.5v7A1.5 1.5 0 0 1 11.5 15h-7A1.5 1.5 0 0 1 3 13.5v-7Zm11 2.06 3-1.8v6.48l-3-1.8V8.56Z" />;
const CAM_OFF = <path d="M3.28 2.22a.75.75 0 1 0-1.06 1.06l1.03 1.03A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16h7c.3 0 .58-.09.82-.24l3.4 3.4a.75.75 0 0 0 1.06-1.06L3.28 2.22ZM13 8.56l3-1.8v6.48l-1.2-.72V8.56ZM6.2 5h5.3A1.5 1.5 0 0 1 13 6.5v.7L6.2 5Z" />;

function VideoTile({
  stream,
  label,
  muted = false,
  self = false,
  controls = null,
  status = null,
  micOn = true,
  burst = [],
}) {
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-xl font-bold text-white">
            {(label || "?").trim().charAt(0).toUpperCase()}
          </span>
          {status && <span className="text-[11px] text-slate-300">{status}</span>}
        </div>
      )}
      {/* Reactions fly up out of this person's own tile. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {burst.map((b) => (
          <span
            key={b.id}
            className="absolute bottom-6 animate-[burst-up_2.2s_ease-out_forwards] text-2xl"
            style={{
              left: `${b.left}%`,
              animationDelay: `${b.delay}s`,
              "--burst-drift": `${b.drift}px`,
              "--burst-scale": b.scale,
            }}
          >
            {b.emoji}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/50 px-2 py-1">
        <span className="flex min-w-0 items-center gap-1">
          {!micOn && (
            <svg aria-hidden="true" className="h-3 w-3 shrink-0 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
              {MIC_OFF}
            </svg>
          )}
          <span className="truncate text-xs font-medium text-white">{label}</span>
        </span>
        {controls && <span className="flex shrink-0 gap-1">{controls}</span>}
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
    joined, connecting, micOn, camOn, hasCamera, hostNotice, error, relaySource,
    peers, roster, localStream, join, leave, toggleMic, toggleCam,
    controlParticipant, controlEveryone, bursts, sendReaction, selfId,
  } = call;

  const isHost = role === "host";
  // Presence gives the people; the peer connections give their media.
  const streamById = new Map((peers ?? []).map((p) => [p.id, p.stream]));
  const others = (roster ?? []).filter((person) => !person.self);

  /** Small pill button used for the host's per-student controls. */
  const tileButton = (onClick, text) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-white/25"
    >
      {text}
    </button>
  );

  if (!joined) {
    return (
      <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{t("call.title")}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{t("call.blurb")}</p>
          </div>
          <Button onClick={join} loading={connecting} icon="camera">
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
            {t("call.live", { count: Math.max(roster?.length ?? 0, 1) })}
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
          <Button variant="ghost" size="sm" onClick={leave} icon="logout">
            {t("call.leave")}
          </Button>
        </div>
      </div>

      {hostNotice && (
        <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-strong" role="status">
          {t(`call.byHost_${hostNotice}`)}
        </p>
      )}

      {/* Whole-room controls: one tap covers every student on the call. */}
      {isHost && others.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
          <span className="text-xs font-semibold text-ink-muted">{t("call.everyone")}</span>
          <Button size="sm" variant="outline" onClick={() => controlEveryone({ mic: false })}>
            {t("call.muteAll")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => controlEveryone({ mic: true })}>
            {t("call.unmuteAll")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => controlEveryone({ cam: false })}>
            {t("call.camsOff")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => controlEveryone({ cam: true })}>
            {t("call.camsOn")}
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <VideoTile
          stream={localStream}
          label={`${selfLabel} (${t("call.you")})`}
          self
          micOn={micOn}
          burst={bursts?.[selfId] ?? []}
        />
        {/* Driven by presence, not by media: everyone in the call has a tile
            from the moment they join, even before their video arrives — which
            is what makes a refresh show the room instead of an empty grid. */}
        {others.map((person) => {
          const stream = streamById.get(person.id);
          return (
            <VideoTile
              key={person.id}
              stream={stream}
              micOn={person.micOn}
              burst={bursts?.[person.id] ?? []}
              status={stream ? null : t("call.connecting")}
              label={person.name || (person.role === "host" ? t("nav.host") : t("call.student"))}
              controls={
                isHost && person.role !== "host" ? (
                  <>
                    {tileButton(() => controlParticipant(person.id, { mic: false }), t("call.mute"))}
                    {tileButton(() => controlParticipant(person.id, { mic: true }), t("call.unmute"))}
                    {tileButton(() => controlParticipant(person.id, { cam: false }), t("call.stopCam"))}
                    {tileButton(() => controlParticipant(person.id, { cam: true }), t("call.startCam"))}
                  </>
                ) : null
              }
            />
          );
        })}
      </div>

      {/* React from inside the call: the emoji leaves your own tile. */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendReaction(emoji)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xl transition-transform hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>

      {others.length === 0 && (
        <p className="mt-3 text-center text-xs text-ink-muted">{t("call.waiting")}</p>
      )}

      {/* Only the host needs to know how traffic is getting through. */}
      {role === "host" && relaySource && (
        <p className="mt-3 text-center text-[11px] text-ink-faint">
          {relaySource === "stun-only"
            ? t("call.relayNone")
            : relaySource === "public"
              ? t("call.relayPublic")
              : t("call.relayConfigured", { source: relaySource })}
        </p>
      )}
    </div>
  );
}
