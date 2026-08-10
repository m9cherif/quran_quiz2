"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getProfile } from "@/lib/auth/client";
import { cleanUser, setAuthStatus, setUser } from "@/store/Slices/userSlice";

/**
 * AuthProvider — restores the Supabase session on boot and keeps the Redux
 * profile in sync with auth events. Supabase itself persists the session
 * tokens; we only mirror the public profile + status.
 */
export function AuthProvider({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured()) {
      dispatch(setAuthStatus("anonymous"));
      return;
    }

    const applySession = async (userId) => {
      if (!mounted) return;
      if (!userId) {
        dispatch(cleanUser());
        dispatch(setAuthStatus("anonymous"));
        return;
      }
      const profile = await getProfile(userId);
      if (!mounted) return;
      if (profile) dispatch(setUser(profile));
      dispatch(setAuthStatus("authenticated"));
    };

    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      applySession(session?.user?.id ?? null);
    });

    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => applySession(session?.user?.id ?? null));

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [dispatch]);

  return children;
}

export default AuthProvider;