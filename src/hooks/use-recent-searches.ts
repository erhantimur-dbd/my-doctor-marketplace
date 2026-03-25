"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "recent_searches";
const MAX_ITEMS = 5;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RecentSearch {
  query: string;
  specialty?: string;
  location?: string;
  placeLat?: number;
  placeLng?: number;
  timestamp: number;
}

/**
 * Track recent search queries in localStorage.
 * Shown in the search dropdown for quick re-searching.
 */
export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: RecentSearch[] = JSON.parse(stored);
        const now = Date.now();
        const fresh = parsed.filter((s) => now - s.timestamp < EXPIRY_MS);
        setSearches(fresh);
        if (fresh.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        }
      }
    } catch {
      // Invalid data — ignore
    }
  }, []);

  const addSearch = useCallback(
    (search: Omit<RecentSearch, "timestamp">) => {
      if (!search.query.trim()) return;

      setSearches((prev) => {
        // Deduplicate: remove existing entry with same query+location
        const filtered = prev.filter(
          (s) =>
            !(
              s.query.toLowerCase() === search.query.toLowerCase() &&
              (s.location || "") === (search.location || "")
            )
        );
        const updated = [
          { ...search, timestamp: Date.now() },
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

  const removeOne = useCallback((timestamp: number) => {
    setSearches((prev) => {
      const updated = prev.filter((s) => s.timestamp !== timestamp);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { searches, addSearch, removeOne, clearAll };
}
