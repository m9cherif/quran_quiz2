import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db/client";
import { emailVerifications } from "@/lib/db/schema";
import type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

/**
 * Email sign-in's own code, sent by SMTP through a Hostinger mailbox — same
 * shape as the phone gateway in smsGateway.ts (this app owns the code: makes
 * it, stores only a salted hash, counts attempts, decides when it expires),
 * just a different delivery channel and its own table.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function matches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !password) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass: password },
    });
  }
  return transporter;
}

async function deliver(email: string, code: string): Promise<VerifyFailure | null> {
  const transport = getTransporter();
  if (!transport) return "not_configured";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    await transport.sendMail({
      from,
      to: email,
      subject: "Your Quran Quiz sign-in code",
      text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
    });
  } catch (err) {
    console.error(`[verify] could not email ${email}:`, err instanceof Error ? err.message : err);
    return "provider_error";
  }
  return null;
}

export async function startEmailVerification(email: string): Promise<StartOutcome> {
  const db = getDb();

  const existingRows = await db
    .select({ createdAt: emailVerifications.createdAt })
    .from(emailVerifications)
    .where(eq(emailVerifications.email, email))
    .limit(1);
  const existing = existingRows[0];
  if (existing?.createdAt) {
    const age = Date.now() - existing.createdAt.getTime();
    if (age < RESEND_COOLDOWN_MS) return { status: "failed", reason: "too_many_requests" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  try {
    await db
      .insert(emailVerifications)
      .values({ email, codeHash: hashCode(code, salt), salt, attempts: 0, expiresAt })
      .onDuplicateKeyUpdate({
        set: { codeHash: hashCode(code, salt), salt, attempts: 0, expiresAt, createdAt: new Date() },
      });
  } catch (err) {
    console.error(`[verify] could not store a code for ${email}:`, err instanceof Error ? err.message : err);
    return { status: "failed", reason: "provider_error" };
  }

  const failure = await deliver(email, code);
  if (failure) {
    await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
    return { status: "failed", reason: failure };
  }

  console.info(`[verify] emailed ${email}: expires ${expiresAt.toISOString()}`);
  return { status: "sent", verification: { expiresAt: expiresAt.toISOString(), channel: "email", reference: null } };
}

export async function checkEmailVerification(email: string, code: string): Promise<CheckOutcome> {
  const db = getDb();

  let row: typeof emailVerifications.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email))
      .limit(1);
    row = rows[0];
  } catch (err) {
    console.error(`[verify] could not read the code for ${email}:`, err instanceof Error ? err.message : err);
    return { status: "failed", reason: "provider_error" };
  }
  if (!row) return { status: "no_verification" };

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
    return { status: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
    return { status: "attempts_exhausted" };
  }

  if (!matches(row.codeHash, hashCode(code, row.salt))) {
    const attempts = row.attempts + 1;
    await db.update(emailVerifications).set({ attempts }).where(eq(emailVerifications.email, email));
    if (attempts >= MAX_ATTEMPTS) {
      await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
      return { status: "attempts_exhausted" };
    }
    return { status: "incorrect", attemptsRemaining: MAX_ATTEMPTS - attempts };
  }

  await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
  return { status: "verified", phone: email };
}
