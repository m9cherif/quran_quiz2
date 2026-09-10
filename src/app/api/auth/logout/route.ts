import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE, tokenFromRequest } from "@/lib/db/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = tokenFromRequest(request);
  if (token) await destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return response;
}
