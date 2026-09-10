import { NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Session bootstrap: who (if anyone) the qq_session cookie belongs to. */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, avatar_url: user.avatarUrl },
  });
}
