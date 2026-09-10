import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { createSession } from "@/lib/db/session";

export interface NewAccountInput {
  name: string;
  /** Exactly one of these — the account is reached by whichever was given. */
  email?: string;
  phone?: string;
  role: "host" | "student" | "admin";
}

/**
 * Creates the account directly — no separate auth-provider identity to
 * create first, since sessions are our own now. The role is decided here,
 * on the server, from data the client cannot reach (see /api/auth/register),
 * same guarantee Supabase's app_metadata gave, just without needing a
 * metadata layer to keep it in.
 */
export async function createUserAccount(input: NewAccountInput) {
  const db = getDb();

  if (input.email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing[0]) throw new Error("An account already uses this email address");
  }
  if (input.phone) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone)).limit(1);
    if (existing[0]) throw new Error("An account already uses this phone number");
  }

  const id = newId();
  await db.insert(users).values({
    id,
    email: input.email ?? null,
    phone: input.phone ?? null,
    name: input.name,
    role: input.role,
  });
  return { id };
}

/**
 * Mint a session for a number Bird Verify (or the SMS gateway / Telegram
 * fallback) has just confirmed. Call this only after that provider answered
 * "verified" — everything upstream of it is what stands between a stranger
 * and someone else's account.
 *
 * Returns null when no account holds the number: signing in never creates
 * one, the role is decided once, at registration.
 */
export async function createPhoneSession(phone: string) {
  const db = getDb();
  // phone arrives already normalised (E.164, with the leading '+') by
  // src/lib/auth/phoneNumber.ts's normalizePhone — the same form it's stored
  // in, so no reformatting needed here.
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
  const user = rows[0];
  if (!user) return null;
  const session = await createSession(user.id);
  return { ...session, userId: user.id };
}

/** Mint a session for an email address just confirmed via /api/auth/email/check. */
export async function createEmailSession(email: string) {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return null;
  const session = await createSession(user.id);
  return { ...session, userId: user.id };
}
