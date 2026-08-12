/**
 * Fetches ICE servers (STUN + TURN) from the server-side broker.
 *
 * Cached for the lifetime of the tab but re-fetched once the credentials are
 * close to expiring, since Cloudflare and Twilio both hand out short-lived
 * ones. Falls back to STUN alone if the broker cannot be reached — direct
 * connections still work on ordinary networks.
 */
export interface IceConfig {
  iceServers: RTCIceServer[];
  source: string;
}

const STUN_ONLY: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

let cached: { config: IceConfig; expiresAt: number } | null = null;
let inFlight: Promise<IceConfig> | null = null;

export function getIceConfig(): Promise<IceConfig> {
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.config);
  if (inFlight) return inFlight;

  inFlight = fetch("/api/turn", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`turn broker ${res.status}`);
      return res.json();
    })
    .then((data: { iceServers?: RTCIceServer[]; source?: string; ttl?: number }) => {
      const config: IceConfig = {
        iceServers: Array.isArray(data.iceServers) && data.iceServers.length
          ? data.iceServers
          : STUN_ONLY,
        source: data.source ?? "unknown",
      };
      // Renew a minute before the credentials actually lapse.
      const ttl = Math.max(60, (data.ttl ?? 3600) - 60);
      cached = { config, expiresAt: Date.now() + ttl * 1000 };
      return config;
    })
    .catch((err) => {
      console.error("Could not load TURN configuration:", err);
      return { iceServers: STUN_ONLY, source: "stun-only" };
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
