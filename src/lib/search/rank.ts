import type { InventoryRankDoctor } from "@/lib/search/types";

export type EarliestSlotFn = (doctorId: string) => number;

/**
 * Marketplace inventory-first ranking:
 * has_slot DESC → next_slot ASC → distance ASC → rating DESC → featured DESC
 */
export function rankDoctorsByInventory<T extends InventoryRankDoctor>(
  doctors: T[],
  earliestMs: EarliestSlotFn,
  proximityDistances?: Map<string, number>
): { ranked: T[]; doctorIdsFullyBooked: string[] } {
  const hasSlot = (id: string) => earliestMs(id) < Infinity;
  const doctorIdsFullyBooked = doctors
    .map((d) => d.id)
    .filter((id) => !hasSlot(id));

  const ranked = [...doctors].sort((a, b) => {
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

    const featA = a.is_featured ? 1 : 0;
    const featB = b.is_featured ? 1 : 0;
    return featB - featA;
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
