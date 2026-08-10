"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Skeleton from "@/components/ui/Skeleton";

/**
 * RequireUser — client-side route guard.
 * Redirects to /login when the (legacy) session user is not present.
 */
export function RequireUser({ children }) {
  const user = useSelector((state) => state.user.user);
  const router = useRouter();
  const redirecting = user === null;

  useEffect(() => {
    if (redirecting) {
      router.replace("/login");
    }
  }, [redirecting, router]);

  if (redirecting) {
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