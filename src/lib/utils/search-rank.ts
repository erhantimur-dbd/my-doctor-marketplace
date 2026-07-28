/**
 * General search ranking for paid Featured listings (all sorts).
 * Inventory/soonest path uses `@/lib/search/rank.rankDoctorsByInventory` which
 * shares the same active-featured definition.
 */

export {
  isActivelyFeatured,
  normalizeFeaturedFlag,
} from "@/lib/search/rank";
import { isActivelyFeatured } from "@/lib/search/rank";

export interface RankableDoctor {
  id: string;
  is_featured?: boolean | null;
  featured_until?: string | null;
  avg_rating?: number | null;
  consultation_fee_cents?: number | null;
  [key: string]: unknown;
}

export type SearchSortMode =
  | "featured"
  | "nearest"
  | "rating"
  | "price_asc"
  | "price_desc"
  | "best_match"
  | "soonest"
  | string
  | undefined;

export interface RankSearchOptions {
  sort?: SearchSortMode;
  /** doctorId → distance km */
  distances?: Map<string, number> | Record<string, number>;
  /** doctorId → match score (higher is better) */
  matchScores?: Map<string, number> | Record<string, number>;
  /** doctorId → earliest slot ms (lower better; Infinity = none) */
  availabilityMs?: Map<string, number> | Record<string, number>;
  /** Reference time for expiry checks (defaults to now) */
  now?: Date;
}

function getNum(
  id: string,
  map?: Map<string, number> | Record<string, number>,
  fallback = Infinity
): number {
  if (!map) return fallback;
  if (map instanceof Map) return map.get(id) ?? fallback;
  return map[id] ?? fallback;
}

function secondaryCompare(
  a: RankableDoctor,
  b: RankableDoctor,
  options: RankSearchOptions
): number {
  const sort = options.sort || "featured";

  switch (sort) {
    case "soonest": {
      return (
        getNum(a.id, options.availabilityMs) -
        getNum(b.id, options.availabilityMs)
      );
    }
    case "nearest": {
      return getNum(a.id, options.distances) - getNum(b.id, options.distances);
    }
    case "rating": {
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    }
    case "price_asc": {
      return (a.consultation_fee_cents ?? 0) - (b.consultation_fee_cents ?? 0);
    }
    case "price_desc": {
      return (b.consultation_fee_cents ?? 0) - (a.consultation_fee_cents ?? 0);
    }
    case "best_match": {
      return (
        getNum(b.id, options.matchScores, 0) -
        getNum(a.id, options.matchScores, 0)
      );
    }
    case "featured":
    default: {
      const hasDistances =
        options.distances &&
        (options.distances instanceof Map
          ? options.distances.size > 0
          : Object.keys(options.distances).length > 0);
      if (hasDistances) {
        const distDiff =
          getNum(a.id, options.distances) - getNum(b.id, options.distances);
        if (distDiff !== 0) return distDiff;
      }
      if (options.availabilityMs) {
        const availDiff =
          getNum(a.id, options.availabilityMs) -
          getNum(b.id, options.availabilityMs);
        if (availDiff !== 0) return availDiff;
      }
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    }
  }
}

/**
 * Sort doctors: active featured first (paid visibility boost), then secondary sort.
 */
export function rankSearchResults<T extends RankableDoctor>(
  doctors: T[],
  options: RankSearchOptions = {}
): T[] {
  const now = options.now ?? new Date();
  return [...doctors].sort((a, b) => {
    const aFeat = isActivelyFeatured(a, now) ? 0 : 1;
    const bFeat = isActivelyFeatured(b, now) ? 0 : 1;
    if (aFeat !== bFeat) return aFeat - bFeat;
    return secondaryCompare(a, b, options);
  });
}

/**
 * Reorder a full ID list using lightweight featured flags + secondary metrics.
 */
export function rankDoctorIds(
  orderedIds: string[],
  flags: Array<{
    id: string;
    is_featured?: boolean | null;
    featured_until?: string | null;
    avg_rating?: number | null;
    consultation_fee_cents?: number | null;
  }>,
  options: RankSearchOptions = {}
): string[] {
  const byId = new Map(flags.map((f) => [f.id, f]));
  const doctors: RankableDoctor[] = orderedIds.map((id) => {
    const row = byId.get(id);
    return {
      id,
      is_featured: row?.is_featured ?? false,
      featured_until: row?.featured_until ?? null,
      avg_rating: row?.avg_rating ?? 0,
      consultation_fee_cents: row?.consultation_fee_cents ?? 0,
    };
  });
  return rankSearchResults(doctors, options).map((d) => d.id);
}
