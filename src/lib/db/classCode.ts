import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { classes } from "./schema";

/**
 * Ports the Postgres trigger `generate_class_code()` / `class_code_trigger()`
 * (supabase/migrations/20260810121600_classes.sql): an 8-char code drawn
 * from the same ambiguous-character-free alphabet as competition codes (see
 * src/lib/db/competitionCode.ts), retried until unique. MySQL has no
 * BEFORE INSERT trigger wired up here, so this runs app-side before the
 * insert.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function generateClassCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    const existing = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.code, code))
      .limit(1);
    if (!existing[0]) return code;
  }
  throw new Error("Could not generate a unique class code");
}
