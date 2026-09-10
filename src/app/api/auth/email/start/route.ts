import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { startEmailVerification } from "@/lib/auth/emailGateway";
import type { VerifyFailure } from "@/lib/auth/verifyTypes";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirrors /api/auth/phone/start — same contract, email channel instead of SMS. */

const STATUS: Record<VerifyFailure, number> = {
  no_next_channel: 409,
  not_configured: 500,
  bad_credentials: 500,
  invalid_number: 400,
  unsupported_destination: 400,
  too_many_requests: 429,
  insufficient_balance: 502,
  provider_error: 502,
  network_error: 502,
};

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "malformed_request" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  // Signing in never creates an account.
  const rows = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!rows[0]) {
    return NextResponse.json({ ok: false, reason: "no_account" }, { status: 404 });
  }

  const outcome = await startEmailVerification(email);
  if (outcome.status === "failed") {
    return NextResponse.json({ ok: false, reason: outcome.reason }, { status: STATUS[outcome.reason] });
  }

  return NextResponse.json({
    ok: true,
    expiresAt: outcome.verification.expiresAt,
    channel: outcome.verification.channel,
    reference: outcome.verification.reference,
  });
}
