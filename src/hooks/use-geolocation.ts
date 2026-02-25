"use client";

import { useState, useEffect, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  supported: boolean;
}

const SESSION_KEY = "mydoctor_geo_coords";

/**
 * Browser Geolocation hook.
 *
 * - `auto`: request position on mount (home page auto-detect)
 * - `manual`: only request when `requestPosition()` is called (doctors filter)
 *
 * Caches accepted coords in sessionStorage so the browser only prompts once
 * per session.
 */
export function useGeolocation(mode: "auto" | "manual" = "manual") {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const [state, setState] = useState<GeolocationState>(() => {
    // Try to rehydrate from sessionStorage (avoids re-prompting)
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (cached) {
          const { latitude, longitude } = JSON.parse(cached);
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
        // Cache for the session
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ latitude, longitude }));
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

  // Auto-request on mount (only when mode === "auto" and no cached coords)
  useEffect(() => {
    if (mode === "auto" && state.latitude === null && supported) {
      requestPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, supported]);

  return { ...state, requestPosition };
}
