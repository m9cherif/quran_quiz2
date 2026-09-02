import { createClient } from "@supabase/supabase-js";

/**
 * Who is asking.
 *
 * The identity comes from the caller's own Supabase session, never from the
 * request body — a body can claim to be anyone.
 */
export async function userFromRequest(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
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
