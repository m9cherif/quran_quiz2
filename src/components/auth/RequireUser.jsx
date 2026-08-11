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
 */
export function RequireUser({ children, role }) {
  const user = useSelector((state) => state.user.user);
  const status = useSelector((state) => state.user.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "checking") return;
    if (status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (role && user?.role !== role) {
      router.replace("/");
    }
  }, [status, role, user?.role, router]);

  if (status === "checking" || status === "anonymous" || (role && user?.role !== role)) {
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