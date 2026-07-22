"use client";

import { create } from "zustand";
import {
  buildDoctorsSearchPath,
  type DoctorsSearchFilters,
  parseDoctorsSearchPath,
} from "@/lib/voice/search-url";

/**
 * Canonical patient search intent for Find a Doctor.
 * Search bar, listing URL, and assistant "apply" all share this shape.
 * URL remains the source of truth after navigation; this store holds the
 * last applied intent for UI sync and one-shot apply from chat.
 */
interface SearchIntentState {
  filters: DoctorsSearchFilters;
  /** Last path we navigated to (prevents thrash) */
  lastAppliedPath: string | null;
  setFilters: (partial: DoctorsSearchFilters) => void;
  replaceFilters: (filters: DoctorsSearchFilters) => void;
  hydrateFromPath: (pathOrSearch: string) => void;
  /**
   * Build path from current (or given) filters. Returns null if already applied
   * to lastAppliedPath (caller should skip navigation).
   */
  prepareApply: (filters?: DoctorsSearchFilters) => string | null;
  markApplied: (path: string) => void;
  clear: () => void;
}

export const useSearchIntentStore = create<SearchIntentState>((set, get) => ({
  filters: {},
  lastAppliedPath: null,
  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),
  replaceFilters: (filters) => set({ filters }),
  hydrateFromPath: (pathOrSearch) => {
    const filters = parseDoctorsSearchPath(pathOrSearch);
    const path = buildDoctorsSearchPath(filters);
    set({ filters, lastAppliedPath: path });
  },
  prepareApply: (filters) => {
    const next = filters ?? get().filters;
    const path = buildDoctorsSearchPath(next);
    if (get().lastAppliedPath === path) return null;
    set({ filters: next });
    return path;
  },
  markApplied: (path) => set({ lastAppliedPath: path }),
  clear: () => set({ filters: {}, lastAppliedPath: null }),
}));
