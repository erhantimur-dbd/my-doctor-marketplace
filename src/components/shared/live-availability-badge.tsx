"use client";

import { useEffect, useState } from "react";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";

/**
 * Hook that provides live availability counts.
 * Starts with initialCounts, fetches on mount, then polls every 60s.
 */
export function useLiveAvailability(initialCounts: Record<string, number> = {}) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const fresh = await getLiveAvailabilityCounts();
        if (!cancelled) setCounts(fresh);
      } catch {
        // silent — badges stay stale
      }
    };
    poll();
    const interval = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return counts;
}

/** Small red badge showing available count */
export function AvailabilityBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-badge-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Legend indicator shown when any specialty has availability */
export function AvailabilityLegend({ counts }: { counts: Record<string, number> }) {
  const hasAny = Object.values(counts).some((c) => c > 0);
  if (!hasAny) return null;
  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      Available within the next hour
    </div>
  );
}
