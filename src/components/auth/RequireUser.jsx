"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Skeleton from "@/components/ui/Skeleton";

/**
 * RequireUser — silent session-aware route guard.
 *   - "checking": session restore in flight (skeleton)
 *   - anonymous:  redirected to /login (no dead-end screen)
 *   - role given and mismatch: redirected to "/" (no dead-end screen)
 * Roles come from the DB profile (server-set), never from the client.
 *
 * Admin bypasses any `role` requirement except its own admin-only pages
 * (those pass role="admin" and mean it) — full control includes reaching
 * the host and student areas, not just a separate admin section.
 */
export function RequireUser({ children, role }) {
  const user = useSelector((state) => state.user.user);
  const status = useSelector((state) => state.user.status);
  const router = useRouter();
  const allowed = !role || user?.role === role || (role !== "admin" && user?.role === "admin");

  useEffect(() => {
    if (status === "checking") return;
    if (status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [status, allowed, router]);

  if (status === "checking" || status === "anonymous" || !allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4" role="status">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return children;
}

export default RequireUser;