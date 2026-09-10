import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { competitions } from "./schema";

/**
 * Ports the Postgres trigger `generate_competition_code()` /
 * `competition_code_trigger()` (supabase/migrations/20260810121000_...sql):
 * an 8-char code drawn from an alphabet without ambiguous characters
 * (no I/L/O/0/1), retried until it's unique. MySQL has no BEFORE INSERT
 * trigger equivalent wired up here, so this runs app-side before the insert.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function generateCompetitionCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    const existing = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.code, code))
      .limit(1);
    if (!existing[0]) return code;
  }
  throw new Error("Could not generate a unique quiz code");
}
