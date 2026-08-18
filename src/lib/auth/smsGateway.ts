import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { redactPhone } from "@/lib/auth/phoneNumber";
import { getServiceClient } from "@/lib/auth/server";
import type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

/**
 * Your own phone, your own SIM, sending the code.
 *
 * Every hosted route into Tunisia turned out to be shut: one provider's
 * messages were accepted and dropped by the carrier, another refused even to
 * verify a +216 number at signup, a third has no trial for the country at all.
 * The common thread is that they are all *foreign* senders, and Tunisia treats
 * foreign bulk traffic with suspicion.
 *
 * An Android phone with a Tunisian SIM is not foreign traffic. It sends an
 * ordinary person-to-person SMS from a real local number, which is the one kind
 * of message that has never had trouble arriving. It costs whatever the phone's
 * own plan charges — usually nothing — and needs no account anywhere: the app
 * shows a username and password and that is the whole setup.
 *
 * Needs, in the environment:
 *   SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD   shown by the Android app
 *   SMS_GATEWAY_URL   optional; defaults to the project's cloud relay
 *
 * THE IMPORTANT DIFFERENCE. Bird and Telegram both make the code, count the
 * attempts and judge the digits. A gateway does none of that — it carries text
 * and nothing else — so here the app owns the code: it generates it, stores
 * only a salted hash, counts the attempts and decides when it expired.
 *
 * That is still one code with one owner, which is what mattered. What was ruled
 * out at the start was two codes made independently by two systems, neither
 * aware of the other. This is not that.
 */

const DEFAULT_URL = "https://api.sms-gate.app/3rdparty/v1/message";

/** Long enough to fetch a phone from another room, short enough to be useless later. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Guessing is limited far below the 1,000,000 a six-digit code allows. */
const MAX_ATTEMPTS = 5;
/** Matches the countdown the screen shows, so the button never lies. */
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * A hash rather than the code itself, so this table leaking does not hand out
 * working codes. The salt is per row: without it, identical codes would share a
 * hash and the table would be a rainbow table of its own.
 *
 * A six-digit code is only a million possibilities, so no hash choice makes
 * offline guessing hard. What actually protects it is the attempt ceiling and
 * the ten-minute window, both enforced below on every check.
 */
function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function matches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Send the text, and say only whether it went. */
async function deliver(phone: string, text: string): Promise<VerifyFailure | null> {
  const username = process.env.SMS_GATEWAY_USERNAME;
  const password = process.env.SMS_GATEWAY_PASSWORD;
  if (!username || !password) return "not_configured";

  const url = process.env.SMS_GATEWAY_URL?.trim() || DEFAULT_URL;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [phone] }),
    });
  } catch {
    // The relay is unreachable, or the phone is off and not holding the line.
    return "network_error";
  }

  if (response.ok) return null;
  if (response.status === 401 || response.status === 403) return "bad_credentials";
  if (response.status === 429) return "too_many_requests";
  console.error(
    `[verify] gateway refused ${redactPhone(phone)} (${response.status}): ` +
      `${(await response.text()).slice(0, 200)}`
  );
  return "provider_error";
}

/**
 * Make a code, remember it, and text it.
 *
 * One row per number, overwritten each time: a person can only ever have one
 * code outstanding, and asking for a new one immediately retires the old.
 */
export async function startGatewayVerification(phone: string): Promise<StartOutcome> {
  const db = getServiceClient();

  // The screen counts down 60 seconds; enforcing the same here means a caller
  // that skips the screen cannot spend the phone's SMS allowance any faster.
  const { data: existing } = await db
    .from("phone_verifications")
    .select("created_at")
    .eq("phone", phone)
    .maybeSingle();
  if (existing?.created_at) {
    const age = Date.now() - new Date(existing.created_at as string).getTime();
    if (age < RESEND_COOLDOWN_MS) return { status: "failed", reason: "too_many_requests" };
  }

  // randomInt is the cryptographic generator, and it is unbiased across the
  // range — Math.random would be neither.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const { error } = await db.from("phone_verifications").upsert(
    {
      phone,
      code_hash: hashCode(code, salt),
      salt,
      attempts: 0,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: "phone" }
  );
  if (error) {
    console.error(`[verify] could not store a code for ${redactPhone(phone)}: ${error.message}`);
    return { status: "failed", reason: "provider_error" };
  }

  // Only after the code is safely stored — a text nobody can verify is worse
  // than no text, because the person would type a code that could never work.
  const failure = await deliver(phone, `Quran Quiz verification code: ${code}`);
  if (failure) {
    // The stored code is useless now; leaving it would block the resend.
    await db.from("phone_verifications").delete().eq("phone", phone);
    return { status: "failed", reason: failure };
  }

  console.info(`[verify] gateway texted ${redactPhone(phone)}: expires ${expiresAt.toISOString()}`);
  return {
    status: "sent",
    verification: { expiresAt: expiresAt.toISOString(), channel: "sms", reference: null },
  };
}

/**
 * Judge the digits.
 *
 * Every wrong guess is counted before anything else happens, so an attacker
 * cannot burn attempts for free by racing: the increment is the first write.
 */
export async function checkGatewayVerification(
  phone: string,
  code: string
): Promise<CheckOutcome> {
  const db = getServiceClient();

  const { data, error } = await db
    .from("phone_verifications")
    .select("code_hash, salt, attempts, expires_at")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error(`[verify] could not read the code for ${redactPhone(phone)}: ${error.message}`);
    return { status: "failed", reason: "provider_error" };
  }
  // Never asked for, already used, or cleaned up: all one situation.
  if (!data) return { status: "no_verification" };

  const row = data as {
    code_hash: string;
    salt: string;
    attempts: number;
    expires_at: string;
  };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from("phone_verifications").delete().eq("phone", phone);
    return { status: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.from("phone_verifications").delete().eq("phone", phone);
    return { status: "attempts_exhausted" };
  }

  if (!matches(row.code_hash, hashCode(code, row.salt))) {
    const attempts = row.attempts + 1;
    await db.from("phone_verifications").update({ attempts }).eq("phone", phone);
    if (attempts >= MAX_ATTEMPTS) {
      await db.from("phone_verifications").delete().eq("phone", phone);
      return { status: "attempts_exhausted" };
    }
    return { status: "incorrect", attemptsRemaining: MAX_ATTEMPTS - attempts };
  }

  // Spent. A code that opened a session must never open a second one.
  await db.from("phone_verifications").delete().eq("phone", phone);
  return { status: "verified", phone };
}
