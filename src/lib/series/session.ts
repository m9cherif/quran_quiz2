import { getSessionUser, tokenFromRequest } from "@/lib/db/session";

/**
 * Who is asking.
 *
 * The identity comes from the caller's own qq_session cookie, never from the
 * request body — a body can claim to be anyone.
 */
export async function userFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionUser(tokenFromRequest(request));
  return session?.id ?? null;
}

/**
 * The seed that fixes which words an exercise hides.
 *
 * Tied to the attempt, so a reload shows the same words — an exercise that
 * changes underneath a student makes every answer already given meaningless —
 * and so two students get different draws of the same exercise.
 */
export function seedFor(attemptId: string, exerciseIndex: number): string {
  return `${attemptId}:${exerciseIndex}`;
}
