"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  supported: boolean;
}

const SESSION_KEY = "mydoctor_geo_coords";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Browser Geolocation hook.
 *
 * - `auto`: request position on mount (home page auto-detect)
 * - `manual`: only request when `requestPosition()` is called (doctors filter)
 *
 * Caches accepted coords + timestamp in sessionStorage so the browser only
 * prompts once per session. Stale cache (>30 min) triggers a background
 * refresh while showing the old coords as initial state.
 */
export function useGeolocation(mode: "auto" | "manual" = "manual") {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  // Track whether cached coords were stale on init (need background refresh)
  const staleRef = useRef(false);

  const [state, setState] = useState<GeolocationState>(() => {
    // Try to rehydrate from sessionStorage (avoids re-prompting)
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (cached) {
          const { latitude, longitude, timestamp } = JSON.parse(cached);
          const age = Date.now() - (timestamp || 0);
          if (age < CACHE_TTL_MS) {
            // Fresh cache — use as-is, no refresh needed
            return { latitude, longitude, loading: false, error: null, supported };
          }
          // Stale cache — use as initial state but flag for background refresh
          staleRef.current = true;
          return { latitude, longitude, loading: false, error: null, supported };
        }
      } catch {
        // Ignore parse errors
      }
    }
    return { latitude: null, longitude: null, loading: false, error: null, supported };
  });

  const requestPosition = useCallback(() => {
    if (!supported) {
      setState((prev) => ({ ...prev, error: "Geolocation not supported" }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Cache with timestamp
        try {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ latitude, longitude, timestamp: Date.now() })
          );
        } catch {
          // Storage full or blocked — non-critical
        }
        setState({ latitude, longitude, loading: false, error: null, supported: true });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [supported]);

  // Auto-request on mount: fire if no coords OR if cache was stale
  useEffect(() => {
    if (mode === "auto" && supported && (state.latitude === null || staleRef.current)) {
      staleRef.current = false; // prevent re-triggering on subsequent renders
      requestPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, supported]);

  return { ...state, requestPosition };
}
