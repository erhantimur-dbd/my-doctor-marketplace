"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
  /** Server-rendered user — avoids client-side getUser() lock contention */
  initialUser?: User | null;
  /** Server-rendered profile — avoids extra client-side query */
  initialProfile?: Profile | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  // No loading needed when server provides data; only loading if we have nothing
  const [loading, setLoading] = useState(false);

  // ── Derived state from props (React-recommended pattern) ──────────
  // When the server re-renders after a redirect (login / logout), it passes
  // new initialUser / initialProfile props. useState ignores subsequent
  // initial values, so we detect the change and update state synchronously
  // during render — no flash of stale UI.
  const [prevInitialUserId, setPrevInitialUserId] = useState<string | null>(
    initialUser?.id ?? null
  );
  if ((initialUser?.id ?? null) !== prevInitialUserId) {
    setPrevInitialUserId(initialUser?.id ?? null);
    setUser(initialUser);
    setProfile(initialProfile);
    setLoading(false);
  }

  // Stable reference to supabase client — avoid re-creating on every render
  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  // ── Real-time auth listener ───────────────────────────────────────
  // Handles: SIGNED_OUT, SIGNED_IN (from other tabs), TOKEN_REFRESHED,
  // USER_UPDATED, PASSWORD_RECOVERY.
  // We skip INITIAL_SESSION because the server already provided that data
  // — this avoids the NavigatorLock contention that caused 10s timeouts.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Server-rendered data covers the initial session; skip to avoid
      // redundant lock acquisition during Supabase's internal _initialize().
      if (event === "INITIAL_SESSION") return;

      try {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", sessionUser.id)
            .single();
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (err) {
        // Don't clear server-provided data on transient errors (lock timeout)
        console.error("Auth state change error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Shared signOut so consumers don't need their own Supabase client
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
