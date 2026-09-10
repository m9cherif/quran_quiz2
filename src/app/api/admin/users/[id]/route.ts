import { NextResponse } from "next/server";
import { adminFromRequest, getServiceClient } from "@/lib/auth/server";

export const runtime = "nodejs";

/**
 * Deleting an auth user is an Admin API operation (auth.admin.deleteUser),
 * not something a SECURITY DEFINER SQL function should do directly — the
 * auth schema's own triggers and related tables (sessions, identities, ...)
 * are Supabase's to manage, so this goes through the same service-role path
 * every other admin.* call does, from a route that checks the caller itself
 * rather than trusting a client-supplied role.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await adminFromRequest(request);
  if (!adminId) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  if (id === adminId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const { error } = await getServiceClient().auth.admin.deleteUser(id);
  if (error) {
    console.error("Admin user delete failed:", error);
    return NextResponse.json({ error: "Could not delete the account" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
