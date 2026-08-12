import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Credentials are short-lived and per-request: never cache this response.
export const dynamic = "force-dynamic";

/**
 * ICE server broker.
 *
 * A browser needs TURN credentials to reach the relay, so they must arrive in
 * the client — but the *provider* API key must not. This route keeps the key
 * server-side and hands out only what the peer connection needs, short-lived
 * where the provider supports it.
 *
 * Configure whichever you have (checked in this order):
 *
 *   Cloudflare Realtime TURN (free tier, credentials expire):
 *     CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
 *   Twilio Network Traversal Service (credentials expire):
 *     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   Any coturn / self-hosted or bought TURN (static credentials):
 *     TURN_URLS (comma separated), TURN_USERNAME, TURN_CREDENTIAL
 *
 * With none of them set it falls back to a free public relay so calls still
 * work behind restrictive NATs — best effort, not something to rely on for a
 * scheduled lesson.
 */

const STUN = {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
};

/** Free public relay — no account, best effort, rate limited by the operator. */
const PUBLIC_TURN = {
  urls: [
    "turn:openrelay.metered.ca:80",
    "turn:openrelay.metered.ca:443",
    "turns:openrelay.metered.ca:443?transport=tcp",
  ],
  username: "openrelayproject",
  credential: "openrelayproject",
};

const TTL_SECONDS = 60 * 60 * 4; // long enough for a lesson

async function cloudflareServers() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare TURN ${res.status}`);
  const data = (await res.json()) as { iceServers?: unknown };
  if (!data?.iceServers) throw new Error("Cloudflare TURN returned no iceServers");
  // Cloudflare already returns a ready-made iceServers entry.
  return { servers: [STUN, data.iceServers], source: "cloudflare" };
}

async function twilioServers() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ Ttl: String(TTL_SECONDS) }),
  });
  if (!res.ok) throw new Error(`Twilio NTS ${res.status}`);
  const data = (await res.json()) as { ice_servers?: Array<Record<string, string>> };
  if (!Array.isArray(data?.ice_servers)) throw new Error("Twilio returned no ice_servers");
  const servers = data.ice_servers.map((s) => ({
    urls: s.url ?? s.urls,
    ...(s.username ? { username: s.username, credential: s.credential } : {}),
  }));
  return { servers, source: "twilio" };
}

function staticServers() {
  const urls = process.env.TURN_URLS;
  if (!urls) return null;
  return {
    servers: [
      STUN,
      {
        urls: urls.split(",").map((u) => u.trim()).filter(Boolean),
        username: process.env.TURN_USERNAME ?? "",
        credential: process.env.TURN_CREDENTIAL ?? "",
      },
    ],
    source: "static",
  };
}

export async function GET() {
  const providers = [cloudflareServers, twilioServers, async () => staticServers()];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        return NextResponse.json(
          { iceServers: result.servers, source: result.source, ttl: TTL_SECONDS },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    } catch (err) {
      // A misconfigured provider must not take the call down: log it and try
      // the next one, ending at the public relay.
      console.error("TURN provider failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json(
    { iceServers: [STUN, PUBLIC_TURN], source: "public", ttl: TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
