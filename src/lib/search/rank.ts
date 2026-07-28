import type { InventoryRankDoctor } from "@/lib/search/types";

export type EarliestSlotFn = (doctorId: string) => number;

/** Active paid Featured boost (unexpired featured_until or null until). */
export function isActivelyFeatured(
  doctor: Pick<InventoryRankDoctor, "is_featured" | "featured_until">,
  now: Date = new Date()
): boolean {
  const raw = doctor.is_featured as unknown;
  const featured =
    raw === true || raw === "true" || raw === 1 || raw === "1";
  if (!featured) return false;
  if (doctor.featured_until == null || doctor.featured_until === "") return true;
  // Normalize Postgres timestamps that may lack a timezone designator
  let untilRaw = String(doctor.featured_until).trim();
  if (
    untilRaw &&
    !untilRaw.endsWith("Z") &&
    !/[+-]\d{2}:\d{2}$/.test(untilRaw)
  ) {
    untilRaw = untilRaw.replace(" ", "T") + "Z";
  }
  const until = new Date(untilRaw);
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() > now.getTime();
}

/**
 * Marketplace ranking with paid Featured visibility boost:
 * active_featured DESC → has_slot DESC → next_slot ASC → distance ASC → rating DESC
 *
 * Featured is a paid package boost: always pins above organic peers that already
 * passed specialty/location/license filters. Within each group, inventory-first
 * (soonest / nearest) still applies.
 */
export function rankDoctorsByInventory<T extends InventoryRankDoctor>(
  doctors: T[],
  earliestMs: EarliestSlotFn,
  proximityDistances?: Map<string, number>,
  now: Date = new Date()
): { ranked: T[]; doctorIdsFullyBooked: string[] } {
  const hasSlot = (id: string) => earliestMs(id) < Infinity;
  const doctorIdsFullyBooked = doctors
    .map((d) => d.id)
    .filter((id) => !hasSlot(id));

  const ranked = [...doctors].sort((a, b) => {
    const featA = isActivelyFeatured(a, now) ? 0 : 1;
    const featB = isActivelyFeatured(b, now) ? 0 : 1;
    if (featA !== featB) return featA - featB;

    const idA = a.id;
    const idB = b.id;
    const slotA = hasSlot(idA) ? 1 : 0;
    const slotB = hasSlot(idB) ? 1 : 0;
    if (slotB !== slotA) return slotB - slotA;

    const tA = earliestMs(idA);
    const tB = earliestMs(idB);
    if (tA !== tB) return tA - tB;

    if (proximityDistances && proximityDistances.size > 0) {
      const dA = proximityDistances.get(idA) ?? Infinity;
      const dB = proximityDistances.get(idB) ?? Infinity;
      if (dA !== dB) return dA - dB;
    }

    const ratingA = Number(a.avg_rating) || 0;
    const ratingB = Number(b.avg_rating) || 0;
    if (ratingB !== ratingA) return ratingB - ratingA;

    return 0;
  });

  return { ranked, doctorIdsFullyBooked };
}

/**
 * Build earliest-ms lookup from primary + optional video availability maps.
 */
export function buildEarliestMsFn(
  availPrimary: Record<string, { slots?: { start: string }[] } | undefined>,
  availVideo: Record<string, { slots?: { start: string }[] } | undefined> = {}
): EarliestSlotFn {
  return (id: string): number => {
    const a = availPrimary[id]?.slots?.[0]?.start;
    const b = availVideo[id]?.slots?.[0]?.start;
    const ta = a ? new Date(a).getTime() : Infinity;
    const tb = b ? new Date(b).getTime() : Infinity;
    return Math.min(ta, tb);
  };
}

/**
 * Normalize is_featured for API/UI when boost window has expired.
 */
export function normalizeFeaturedFlag<T extends InventoryRankDoctor>(
  doctor: T,
  now: Date = new Date()
): T {
  // Coerce string/number flags from JSON/PostgREST edge cases
  const raw = doctor.is_featured as unknown;
  const featured =
    raw === true || raw === "true" || raw === 1 || raw === "1";
  if (!featured) {
    return doctor.is_featured === false ? doctor : { ...doctor, is_featured: false };
  }
  const normalized = { ...doctor, is_featured: true as boolean };
  if (isActivelyFeatured(normalized, now)) return normalized;
  return { ...doctor, is_featured: false };
}

/**
 * Final safety pin: active featured first, preserve relative order within groups.
 * Call on every search result list before returning to the client.
 */
export function pinActiveFeaturedFirst<T extends InventoryRankDoctor>(
  doctors: T[],
  now: Date = new Date()
): T[] {
  if (doctors.length <= 1) {
    return doctors.map((d) => normalizeFeaturedFlag(d, now));
  }
  const featured: T[] = [];
  const organic: T[] = [];
  for (const d of doctors) {
    const n = normalizeFeaturedFlag(d, now);
    if (isActivelyFeatured(n, now)) featured.push(n);
    else organic.push(n);
  }
  return [...featured, ...organic];
}
