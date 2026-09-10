import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports admin_list_profiles() (supabase/migrations/20260910120000_admin_role.sql).
 * auth.users + profiles are merged into one `users` row now, so there's no
 * join left to do — every field it returned is already on this row.
 *
 * Role is re-checked here from the session row itself (the trust boundary in
 * this backend), not delegated to anything that could be skipped — see the
 * task note on every admin route re-checking this explicitly.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      email: r.email,
      phone: r.phone,
      created_at: r.createdAt.toISOString(),
    }))
  );
}
