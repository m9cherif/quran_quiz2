"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

/**
 * useCall — a classroom voice/video room built on plain WebRTC, with Supabase
 * Realtime broadcast carrying the signalling. No media server and no third
 * party: the host is the hub and every student holds exactly one peer
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
 */
import { getIceConfig } from "./iceServers";

const FALLBACK_ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

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
  const [forcedMute, setForcedMute] = useState(false);

  const selfIdRef = useRef(randomId());
  const iceServersRef = useRef(FALLBACK_ICE);
  const [relaySource, setRelaySource] = useState("");
  const localStreamRef = useRef(null);
  const channelRef = useRef(null);
  const pcsRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const namesRef = useRef(new Map());

  const send = useCallback((event, payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event,
      payload: { ...payload, from: selfIdRef.current, role, name: displayName },
    });
  }, [role, displayName]);

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

  const leave = useCallback(() => {
    send("bye", {});
    for (const id of Array.from(pcsRef.current.keys())) dropPeer(id);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      getSupabase().removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setPeers([]);
    setJoined(false);
    setForcedMute(false);
  }, [dropPeer, send]);

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

      const channel = getSupabase().channel(`call-${competitionId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "hello" }, async ({ payload }) => {
          if (!payload?.from || payload.from === selfIdRef.current) return;
          namesRef.current.set(payload.from, payload.name ?? "");
          // The host dials the newcomer; students never call each other.
          if (role !== "host" || payload.role === "host") return;
          const pc = peerFor(payload.from, payload.role);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send("offer", { to: payload.from, sdp: pc.localDescription });
        })
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload?.to !== selfIdRef.current) return;
          namesRef.current.set(payload.from, payload.name ?? "");
          const pc = peerFor(payload.from, payload.role);
          await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send("answer", { to: payload.from, sdp: pc.localDescription });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload?.to !== selfIdRef.current) return;
          const pc = pcsRef.current.get(payload.from);
          // Accept the answer whenever we are waiting for one — including the
          // second time round after an ICE restart.
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(payload.sdp);
          }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload?.to !== selfIdRef.current) return;
          const pc = pcsRef.current.get(payload.from);
          if (!pc || !payload.candidate) return;
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            // A candidate arriving before the description is expected noise.
          }
        })
        .on("broadcast", { event: "bye" }, ({ payload }) => {
          if (payload?.from) dropPeer(payload.from);
        })
        .on("broadcast", { event: "force-mute" }, ({ payload }) => {
          // Host asked this device to go quiet.
          if (payload?.to !== selfIdRef.current) return;
          localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
          setMicOn(false);
          setForcedMute(true);
        });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") send("hello", {});
      });
      channelRef.current = channel;
      setJoined(true);
    } catch (err) {
      console.error("Call join failed:", err);
      setError(err?.name === "NotAllowedError" ? "denied" : "failed");
    } finally {
      setConnecting(false);
    }
  }, [competitionId, connecting, dropPeer, joined, peerFor, role, send]);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !micOn;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
    if (next) setForcedMute(false);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    const next = !camOn;
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  /** Host-only: ask one participant's device to mute itself. */
  const muteParticipant = useCallback((peerId) => send("force-mute", { to: peerId }), [send]);

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
    forcedMute,
    error,
    peers,
    localStream: localStreamRef.current,
    join,
    leave,
    toggleMic,
    toggleCam,
    muteParticipant,
  };
}

export default useCall;
