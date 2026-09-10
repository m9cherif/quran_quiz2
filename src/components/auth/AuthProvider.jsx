"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { cleanUser, setAuthStatus, setUser } from "@/store/Slices/userSlice";

/**
 * AuthProvider — restores the session on boot from the qq_session cookie.
 * There's no client-side SDK maintaining live session state any more (no
 * Supabase auth client, no onAuthStateChange) — sign-in/out both happen via
 * a full navigation already, so a single fetch on mount is enough to pick up
 * whatever the cookie says.
 */
export function AuthProvider({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.user) {
          dispatch(setUser(data.user));
          dispatch(setAuthStatus("authenticated"));
        } else {
          dispatch(cleanUser());
          dispatch(setAuthStatus("anonymous"));
        }
      })
      .catch(() => {
        if (!mounted) return;
        dispatch(cleanUser());
        dispatch(setAuthStatus("anonymous"));
      });

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  return children;
}

export default AuthProvider;
