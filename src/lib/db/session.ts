import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { newToken } from "@/lib/db/id";

export const SESSION_COOKIE = "qq_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  name: string;
  role: "host" | "student" | "admin";
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

/** Mints a session row and returns the token to set as a cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, token));
}

/** Cookie → sessions → users. Returns null for no cookie, an unknown/expired token, or a deleted user. */
export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, role: row.role as SessionUser["role"] };
}

/** Server Component / Route Handler helper — reads the cookie via next/headers. */
export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

/** For routes that read the cookie off a raw Request instead of next/headers. */
export function tokenFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
