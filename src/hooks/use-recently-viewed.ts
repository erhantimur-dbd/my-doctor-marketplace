"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "recently_viewed_doctors";
const MAX_ITEMS = 10;
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export interface RecentlyViewedDoctor {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  rating: number;
  viewedAt: number;
}

/**
 * Track recently viewed doctor profiles in localStorage.
 * Returns list of recently viewed doctors and a function to add new ones.
 */
export function useRecentlyViewed() {
  const [doctors, setDoctors] = useState<RecentlyViewedDoctor[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: RecentlyViewedDoctor[] = JSON.parse(stored);
        // Filter out entries older than 14 days
        const now = Date.now();
        const fresh = parsed.filter((d) => now - d.viewedAt < EXPIRY_MS);
        setDoctors(fresh);
        // Persist the cleaned list back
        if (fresh.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        }
      }
    } catch {
      // Invalid data — ignore
    }
  }, []);

  const trackView = useCallback(
    (doctor: Omit<RecentlyViewedDoctor, "viewedAt">) => {
      setDoctors((prev) => {
        // Remove existing entry for this doctor
        const filtered = prev.filter((d) => d.id !== doctor.id);
        // Add at front with timestamp
        const updated = [
          { ...doctor, viewedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_ITEMS);

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Storage full — ignore
        }
        return updated;
      });
    },
    []
  );

  const clearAll = useCallback(() => {
    setDoctors([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { doctors, trackView, clearAll };
}
