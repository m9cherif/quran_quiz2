"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeEvents } from "@/lib/realtime/useRealtimeEvents";

/**
 * useCall — a classroom voice/video room built on plain WebRTC, with the SSE
 * realtime bus + a presence primitive carrying the signalling and roster
 * (replacing Supabase Realtime broadcast + presence). No media server and no
 * third party: the host is the hub and every student holds exactly one peer
 * connection to them (a star, not a mesh), which is what a class actually
 * needs — students hear the teacher, not each other's background noise.
 *
 * Media is requested once, with audio and video together, and the toggles then
 * flip `track.enabled`. That deliberately avoids renegotiating mid-lesson: the
 * camera light goes out and no frames are sent, but the connection is
 * untouched. If the camera is refused we fall back to audio only.
 *
 * Connectivity: STUN handles ordinary networks, and TURN relays the traffic
 * when a firewall blocks peer-to-peer. Both come from /api/turn, which keeps
 * the provider API key server-side and mints short-lived credentials.
 *
 * Signalling: POSTs to /api/games/[id]/call/signal, delivered to every other
 * listener on the competition's SSE stream as a "call-signal" event — the
 * same fire-and-forget, no-delivery-confirmation contract the old broadcast
 * channel had.
 *
 * Roster/presence: the generic heartbeat+TTL primitive
 * (src/lib/realtime/presence.ts) under room id `call-${competitionId}`, a
 * namespace independent of the game presence room. A closed tab or crashed
 * browser is detected by that TTL expiring, not by anything client-side —
 * exactly replacing what Supabase Presence's socket-close detection gave for
 * free.
 */
import { getIceConfig } from "./iceServers";

const FALLBACK_ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const HEARTBEAT_MS = 8000;
const ROSTER_POLL_MS = 4000;

const randomId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`).slice(0, 12);

export function useCall({ competitionId, role, displayName, enabled }) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState("");
  const [peers, setPeers] = useState([]); // [{ id, name, stream, role }]
  /**
   * Who is in the call right now, from the presence primitive — independent
   * of whether media has negotiated yet. This is what survives a refresh:
   * the roster is polled right away on join, so a reloaded page shows
   * everyone immediately instead of an empty call.
   */
  const [roster, setRoster] = useState([]);
  /** Last thing the host did to this device: micOn|micOff|camOn|camOff. */
  const [hostNotice, setHostNotice] = useState("");

  const selfIdRef = useRef(randomId());
  const iceServersRef = useRef(FALLBACK_ICE);
  const [relaySource, setRelaySource] = useState("");
  const localStreamRef = useRef(null);
  const pcsRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const namesRef = useRef(new Map());
  const dialingRef = useRef(new Set()); // offers in flight, so nobody is dialled twice
  const joinedRef = useRef(false);
  const micOnRef = useRef(micOn);
  const camOnRef = useRef(camOn);
  const roleRef = useRef(role);
  const displayNameRef = useRef(displayName);
  roleRef.current = role;
  displayNameRef.current = displayName;

  const send = useCallback(
    (event, payload) => {
      fetch(`/api/games/${competitionId}/call/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          payload: { ...payload, from: selfIdRef.current, role, name: displayName },
        }),
      }).catch(() => {});
    },
    [competitionId, role, displayName]
  );

  const dropPeer = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcsRef.current.delete(peerId);
    }
    setPeers((prev) => prev.filter((p) => p.id !== peerId));
  }, []);

  /** Build (or reuse) the connection to one participant. */
  const peerFor = useCallback(
    (peerId, peerRole) => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        // A handful of candidates is plenty and speeds up connection setup.
        iceCandidatePoolSize: 2,
      });
      pcsRef.current.set(peerId, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send("ice", { to: peerId, candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        const [remote] = event.streams;
        setPeers((prev) => {
          const name = namesRef.current.get(peerId) ?? "";
          const next = prev.filter((p) => p.id !== peerId);
          return [...next, { id: peerId, name, stream: remote, role: peerRole }];
        });
      };

      pc.onconnectionstatechange = () => {
        // "disconnected" is often a passing blip (wifi handover, a tunnel
        // re-forming); give it a moment before tearing the tile down.
        if (pc.connectionState === "failed") {
          if (role === "host" && typeof pc.restartIce === "function") {
            pc.restartIce();
            // Re-offer so the restarted candidates actually reach the peer.
            pc.createOffer({ iceRestart: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => send("offer", { to: peerId, sdp: pc.localDescription }))
              .catch(() => dropPeer(peerId));
          } else {
            dropPeer(peerId);
          }
        } else if (pc.connectionState === "closed") {
          dropPeer(peerId);
        }
      };

      return pc;
    },
    [dropPeer, role, send]
  );

  const touchPresence = useCallback(
    (meta) => {
      fetch(`/api/rooms/${encodeURIComponent(`call-${competitionId}`)}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selfIdRef.current, meta }),
      }).catch(() => {});
    },
    [competitionId]
  );

  const leave = useCallback(() => {
    send("bye", {});
    for (const id of Array.from(pcsRef.current.keys())) dropPeer(id);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    try {
      fetch(`/api/rooms/${encodeURIComponent(`call-${competitionId}`)}/presence`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selfIdRef.current }),
        keepalive: true,
      });
    } catch {
      // Best-effort — the TTL in presence.ts is the real fallback.
    }
    setPeers([]);
    setRoster([]);
    setJoined(false);
    joinedRef.current = false;
    setHostNotice("");
  }, [competitionId, dropPeer, send]);

  /** Keep the roster's mic/camera badges honest as the toggles are used. */
  useEffect(() => {
    micOnRef.current = micOn;
    camOnRef.current = camOn;
    if (!joined) return;
    touchPresence({ name: displayName, role, micOn, camOn });
  }, [joined, micOn, camOn, displayName, role, touchPresence]);

  /** Dial anyone already in the roster the host hasn't dialled yet (host only). */
  const dialPresentPeers = useCallback(
    (people) => {
      if (roleRef.current !== "host") return;
      for (const person of people) {
        if (person.self || person.role === "host") continue;
        if (pcsRef.current.has(person.id) || dialingRef.current.has(person.id)) continue;
        dialingRef.current.add(person.id);
        const pc = peerFor(person.id, person.role);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => send("offer", { to: person.id, sdp: pc.localDescription }))
          .catch(() => dropPeer(person.id))
          .finally(() => dialingRef.current.delete(person.id));
      }
    },
    [dropPeer, peerFor, send]
  );

  const rosterKeysRef = useRef(new Set());
  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(`call-${competitionId}`)}/presence`);
      if (!res.ok) return;
      const entries = await res.json();
      const people = entries.map((entry) => {
        const meta = entry.meta ?? {};
        return {
          id: entry.key,
          name: meta.name ?? "",
          role: meta.role ?? "student",
          micOn: meta.micOn !== false,
          camOn: Boolean(meta.camOn),
          self: entry.key === selfIdRef.current,
        };
      });
      setRoster(people);
      for (const person of people) namesRef.current.set(person.id, person.name);

      // Anyone who dropped out of a fresh snapshot vs. the previous one is
      // gone (TTL expired, tab closed) — same effect as Presence's "leave"
      // event, no separate event type needed.
      const currentKeys = new Set(people.map((p) => p.id));
      for (const prevKey of rosterKeysRef.current) {
        if (!currentKeys.has(prevKey) && prevKey !== selfIdRef.current) dropPeer(prevKey);
      }
      rosterKeysRef.current = currentKeys;

      // A host that reloads has no peer connections left; dial whoever is
      // already sitting in the call rather than waiting for them to
      // re-announce (they will not — they never left).
      dialPresentPeers(people);
    } catch {
      // Poll again on the next tick.
    }
  }, [competitionId, dialPresentPeers, dropPeer]);

  const join = useCallback(async () => {
    if (joined || connecting || !competitionId) return;
    setConnecting(true);
    setError("");
    try {
      // Relay credentials must be in hand before the first peer connection is
      // built, or that peer would be created STUN-only and fail on a network
      // that needs TURN.
      const ice = await getIceConfig();
      iceServersRef.current = ice.iceServers;
      setRelaySource(ice.source);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setHasCamera(true);
      } catch {
        // No camera (or refused): a voice-only seat is still useful.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setHasCamera(false);
      }
      localStreamRef.current = stream;
      // Camera starts dark; the student opts in.
      stream.getVideoTracks().forEach((t) => (t.enabled = false));
      stream.getAudioTracks().forEach((t) => (t.enabled = true));
      setMicOn(true);
      setCamOn(false);

      rosterKeysRef.current = new Set();
      touchPresence({ name: displayName, role, micOn: true, camOn: false, joinedAt: Date.now() });
      send("hello", {});
      await fetchRoster();

      setJoined(true);
      joinedRef.current = true;
    } catch (err) {
      console.error("Call join failed:", err);
      setError(err?.name === "NotAllowedError" ? "denied" : "failed");
    } finally {
      setConnecting(false);
    }
  }, [competitionId, connecting, displayName, fetchRoster, joined, role, send, touchPresence]);

  // Signalling dispatch: one SSE subscription instead of five separate
  // Supabase broadcast listeners, gated so it only listens while in a call.
  useRealtimeEvents(
    competitionId,
    (event) => {
      if (event?.type !== "call-signal" || !joinedRef.current) return;
      const { event: signalEvent, payload } = event.payload ?? {};
      if (!payload) return;

      switch (signalEvent) {
        case "hello": {
          if (!payload.from || payload.from === selfIdRef.current) return;
          namesRef.current.set(payload.from, payload.name ?? "");
          // The host dials the newcomer; students never call each other.
          if (roleRef.current !== "host" || payload.role === "host") return;
          {
            const pc = peerFor(payload.from, payload.role);
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => send("offer", { to: payload.from, sdp: pc.localDescription }))
              .catch(() => dropPeer(payload.from));
          }
          return;
        }
        case "offer": {
          if (payload.to !== selfIdRef.current) return;
          namesRef.current.set(payload.from, payload.name ?? "");
          {
            const pc = peerFor(payload.from, payload.role);
            pc.setRemoteDescription(payload.sdp)
              .then(() => pc.createAnswer())
              .then((answer) => pc.setLocalDescription(answer))
              .then(() => send("answer", { to: payload.from, sdp: pc.localDescription }))
              .catch(() => {});
          }
          return;
        }
        case "answer": {
          if (payload.to !== selfIdRef.current) return;
          {
            const pc = pcsRef.current.get(payload.from);
            // Accept the answer whenever we are waiting for one — including
            // the second time round after an ICE restart.
            if (pc && pc.signalingState === "have-local-offer") {
              pc.setRemoteDescription(payload.sdp).catch(() => {});
            }
          }
          return;
        }
        case "ice": {
          if (payload.to !== selfIdRef.current) return;
          {
            const pc = pcsRef.current.get(payload.from);
            if (!pc || !payload.candidate) return;
            pc.addIceCandidate(payload.candidate).catch(() => {
              // A candidate arriving before the description is expected noise.
            });
          }
          return;
        }
        case "bye": {
          if (payload.from) dropPeer(payload.from);
          return;
        }
        case "host-control": {
          // The host drives this device's mic/camera. Addressed to one
          // student or to "all". The change is always announced on screen —
          // a camera must never light up without the person seeing why.
          if (payload.to !== selfIdRef.current && payload.to !== "all") return;
          if (payload.role !== "host") return;

          const stream = localStreamRef.current;
          if (!stream) return;

          if (typeof payload.mic === "boolean") {
            stream.getAudioTracks().forEach((t) => (t.enabled = payload.mic));
            setMicOn(payload.mic);
          }
          if (typeof payload.cam === "boolean") {
            const videos = stream.getVideoTracks();
            if (videos.length > 0) {
              videos.forEach((t) => (t.enabled = payload.cam));
              setCamOn(payload.cam);
            }
          }
          setHostNotice(
            typeof payload.cam === "boolean" && typeof payload.mic !== "boolean"
              ? payload.cam
                ? "camOn"
                : "camOff"
              : payload.mic
                ? "micOn"
                : "micOff"
          );
          return;
        }
        default:
          return;
      }
    },
    joined
  );

  // Presence: heartbeat while joined, and poll the roster (also refetched on
  // an SSE "presence" nudge below).
  useEffect(() => {
    if (!joined) return undefined;
    const timer = setInterval(() => {
      touchPresence({ name: displayNameRef.current, role: roleRef.current, micOn: micOnRef.current, camOn: camOnRef.current });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [joined, touchPresence]);

  useEffect(() => {
    if (!joined) return undefined;
    const timer = setInterval(fetchRoster, ROSTER_POLL_MS);
    return () => clearInterval(timer);
  }, [joined, fetchRoster]);

  useRealtimeEvents(
    competitionId,
    (event) => {
      if (event?.type === "presence" && joinedRef.current) fetchRoster();
    },
    joined
  );

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !micOn;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
    setHostNotice("");
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    const next = !camOn;
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
    setHostNotice("");
  }, [camOn]);

  /**
   * Host-only: drive a student's mic/camera, or every student at once with
   * "all". Pass only what should change, e.g. { mic: false } or { cam: true }.
   */
  const controlParticipant = useCallback(
    (peerId, changes) => send("host-control", { to: peerId, ...changes }),
    [send]
  );

  const controlEveryone = useCallback(
    (changes) => send("host-control", { to: "all", ...changes }),
    [send]
  );

  // The host closing the room, or the page going away, must free the camera.
  useEffect(() => {
    if (!enabled && joined) leave();
  }, [enabled, joined, leave]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    joined,
    connecting,
    relaySource,
    micOn,
    camOn,
    hasCamera,
    hostNotice,
    error,
    peers,
    roster,
    localStream: localStreamRef.current,
    join,
    leave,
    toggleMic,
    toggleCam,
    controlParticipant,
    controlEveryone,
  };
}

export default useCall;
