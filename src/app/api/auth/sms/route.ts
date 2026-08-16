import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivers the sign-in code by SMS, on Supabase's behalf.
 *
 * Supabase can only speak to a handful of SMS providers itself, and its
 * MessageBird integration talks to the old API — the one with an access_key,
 * which the current Bird platform no longer issues. Its Verify product cannot
 * stand in either: Verify makes up its own code, while Supabase has already
 * made one and expects it to arrive unchanged.
 *
 * So Supabase stops being the sender. Its "Send SMS" hook posts the code here,
 * and this route hands it to Bird's own API. Supabase still generates and still
 * checks the code, which is the part that matters: nothing about how a session
 * is granted moves into this file.
 *
 * The provider is a setting, not a decision baked into this file. Twilio has no
 * trials in Tunisia and Bird issues no SMS channel there, so which company can
 * actually be signed up for is not something to hard-code — SMS_PROVIDER picks,
 * and adding another is one function.
 *
 * Needs, in the environment:
 *   SEND_SMS_HOOK_SECRET  the secret Supabase shows when the hook is created
 *   SMS_PROVIDER          "bird" | "infobip" | "vonage"
 *
 *   bird     BIRD_API_KEY, BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID
 *   infobip  INFOBIP_BASE_URL (yours, e.g. xyz.api.infobip.com),
 *            INFOBIP_API_KEY, INFOBIP_SENDER
 *   vonage   VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_SENDER
 */

/**
 * Standard Webhooks signature, as Supabase sends it.
 *
 * Without this the endpoint is a free SMS gateway for anyone who finds the URL
 * — they would choose the number and the text, at your expense.
 */
function signatureIsValid(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  // A replayed request is a request someone kept: five minutes is enough for a
  // slow network and short enough to be useless later.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^v1,whsec_|^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  // The header may carry several versions, space separated: "v1,<sig> v2,<sig>".
  return signature.split(" ").some((part) => {
    const value = part.includes(",") ? part.split(",")[1] : part;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Tunisian mobile numbers are eight digits after +216, and they start with 2,
 * 4, 5 or 9. The other prefixes are landlines, which cannot receive an SMS —
 * accepting one would spend a message on a number that can never answer.
 */
const TUNISIAN_MOBILE = /^\+216[2459]\d{7}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/** Never write a whole number to a log: the last three digits identify it. */
function redact(phone: string): string {
  return phone.length > 4 ? `…${phone.slice(-3)}` : "…";
}

type Sender = (phone: string, text: string) => Promise<void>;

/** Whatever the provider says when it refuses — far more useful than our words. */
async function refuse(name: string, response: Response): Promise<never> {
  throw new Error(`${name} refused the message (${response.status}): ${await response.text()}`);
}

async function sendViaBird(phone: string, text: string) {
  const { BIRD_API_KEY, BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID } = process.env;
  if (!BIRD_API_KEY || !BIRD_WORKSPACE_ID || !BIRD_CHANNEL_ID) {
    throw new Error("Bird credentials are missing from the environment");
  }

  const response = await fetch(
    `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${BIRD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receiver: { contacts: [{ identifierValue: phone }] },
        body: { type: "text", text: { text } },
      }),
    }
  );

  if (!response.ok) await refuse("Bird", response);
}

async function sendViaInfobip(phone: string, text: string) {
  const { INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER } = process.env;
  if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY) {
    throw new Error("Infobip credentials are missing from the environment");
  }
  const base = INFOBIP_BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const response = await fetch(`https://${base}/sms/2/text/advanced`, {
    method: "POST",
    headers: { Authorization: `App ${INFOBIP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { destinations: [{ to: phone }], from: INFOBIP_SENDER || "QuranQuiz", text },
      ],
    }),
  });
  if (!response.ok) await refuse("Infobip", response);
}

async function sendViaVonage(phone: string, text: string) {
  const { VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_SENDER } = process.env;
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    throw new Error("Vonage credentials are missing from the environment");
  }
  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: VONAGE_API_KEY,
      api_secret: VONAGE_API_SECRET,
      to: phone.replace(/^\+/, ""),
      from: VONAGE_SENDER || "QuranQuiz",
      text,
    }),
  });
  if (!response.ok) await refuse("Vonage", response);
  // Vonage answers 200 even when it did not send; the status is in the body.
  const result = await response.json();
  const first = result?.messages?.[0];
  if (first?.status !== "0") {
    throw new Error(`Vonage refused the message (${first?.status}): ${first?.["error-text"]}`);
  }
}

const SENDERS: Record<string, Sender> = {
  bird: sendViaBird,
  infobip: sendViaInfobip,
  vonage: sendViaVonage,
};

export async function POST(request: Request) {
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) {
    console.error("[sms] SEND_SMS_HOOK_SECRET is not set — refusing to send");
    return NextResponse.json({ error: "SMS sending is not configured" }, { status: 500 });
  }

  const body = await request.text();
  if (!signatureIsValid(secret, request.headers, body)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const otp = payload?.sms?.otp;
  const raw = payload?.user?.phone;
  if (!otp || !raw) {
    return NextResponse.json({ error: "Payload has no phone or code" }, { status: 400 });
  }
  // Supabase sends the number with its plus, but not every version does, and
  // every provider here wants E.164.
  const phone = (raw.startsWith("+") ? raw : `+${raw}`).replace(/[^\d+]/g, "");
  if (!E164.test(phone)) {
    console.error(`[sms] refusing a number that is not E.164: ${redact(phone)}`);
    return NextResponse.json(
      { error: { http_code: 400, message: "That phone number is not in international format." } },
      { status: 400 }
    );
  }
  if (phone.startsWith("+216") && !TUNISIAN_MOBILE.test(phone)) {
    console.error(`[sms] refusing a Tunisian number that cannot receive SMS: ${redact(phone)}`);
    return NextResponse.json(
      { error: { http_code: 400, message: "That Tunisian number is not a mobile number." } },
      { status: 400 }
    );
  }

  const provider = (process.env.SMS_PROVIDER ?? "bird").toLowerCase();
  const send = SENDERS[provider];
  if (!send) {
    console.error(`[sms] unknown SMS_PROVIDER "${provider}"`);
    return NextResponse.json({ error: "SMS sending is not configured" }, { status: 500 });
  }

  try {
    await send(phone, `Quran Quiz verification code: ${otp}`);
    return NextResponse.json({});
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // The provider's answer can quote the number back at us, so it is trimmed
    // to its first line and the recipient is only ever logged redacted.
    console.error(`[sms] ${provider} failed for ${redact(phone)}: ${message.split(String.fromCharCode(10))[0].slice(0, 200)}`);
    // Supabase shows this to the person trying to sign in, so it says what
    // happened without repeating a provider's internals.
    return NextResponse.json(
      { error: { http_code: 500, message: "The code could not be sent by SMS. Try email instead." } },
      { status: 500 }
    );
  }
}
