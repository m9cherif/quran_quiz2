import { randomUUID, randomBytes } from "node:crypto";

/** uuid primary keys are generated here, not in SQL — see schema.ts's note. */
export function newId(): string {
  return randomUUID();
}

/** Opaque random tokens (session ids, participant codes/tokens) — not uuids. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
