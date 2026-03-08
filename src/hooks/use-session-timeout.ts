"use client";

import { useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side idle session timeout for healthcare compliance.
 * Signs the user out after a period of inactivity (no mouse, keyboard, or touch).
 *
 * Defaults:
 *  - Doctor/Admin portals: 15 minutes
 *  - Patient portal: 30 minutes
 */
export function useSessionTimeout(timeoutMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    window.location.href = "/en/login?reason=session_expired";
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);

    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [timeoutMs, handleTimeout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, [resetTimer]);
}
