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
 * Needs, in the environment:
 *   SEND_SMS_HOOK_SECRET  the secret Supabase shows when the hook is created
 *   BIRD_API_KEY          an API key from Bird
 *   BIRD_WORKSPACE_ID     the workspace the SMS channel belongs to
 *   BIRD_CHANNEL_ID       the SMS channel to send from
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

  if (!response.ok) {
    // Bird's own words are far more useful here than ours would be.
    throw new Error(`Bird refused the message (${response.status}): ${await response.text()}`);
  }
}

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
  // Supabase stores the number without its plus; Bird wants E.164.
  const phone = raw.startsWith("+") ? raw : `+${raw}`;

  try {
    await sendViaBird(phone, `${otp} — رمز الدخول إلى مسابقات القرآن`);
    return NextResponse.json({});
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[sms] could not send:", message);
    // Supabase shows this to the person trying to sign in, so it says what
    // happened without repeating a provider's internals.
    return NextResponse.json(
      { error: { http_code: 500, message: "The code could not be sent by SMS. Try email instead." } },
      { status: 500 }
    );
  }
}
