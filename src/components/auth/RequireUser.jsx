"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Skeleton from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * RequireUser — session-aware route guard.
 *   - "checking": session restore in flight (skeleton)
 *   - anonymous:  redirect to /login
 *   - role given and role mismatch: show access-denied card
 * Roles come from the DB profile (server-set), not from the client.
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

  if (status === "checking") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4" role="status">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4" role="status">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (role && user?.role !== role) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">Access restricted</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This area is only available to {role} accounts.
          </p>
          <Button href="/" className="mt-6 w-full">
            Back to home
          </Button>
        </Card>
      </div>
    );
  }

  return children;
}

export default RequireUser;