/**
 * Founding Doctor Programme helpers.
 * Spot claim is atomic in Postgres (claim_founding_member RPC).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { FOUNDING_PROGRAMME_MAX_SPOTS } from "@/lib/constants/company";
import { log } from "@/lib/utils/logger";

export interface FoundingProgrammeStatus {
  maxSpots: number;
  claimedSpots: number;
  remainingSpots: number;
  isOpen: boolean;
  pricingNote: string;
}

export async function getFoundingProgrammeStatus(): Promise<FoundingProgrammeStatus> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("founding_programme")
    .select("max_spots, claimed_spots, is_open, pricing_note")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    // Table may not be migrated yet — safe defaults matching marketing
    return {
      maxSpots: FOUNDING_PROGRAMME_MAX_SPOTS,
      claimedSpots: 0,
      remainingSpots: FOUNDING_PROGRAMME_MAX_SPOTS,
      isOpen: true,
      pricingNote:
        "Founding pricing locked for life for the first 100 doctors who register.",
    };
  }

  const maxSpots = data.max_spots ?? FOUNDING_PROGRAMME_MAX_SPOTS;
  const claimedSpots = data.claimed_spots ?? 0;
  const remaining = Math.max(0, maxSpots - claimedSpots);

  return {
    maxSpots,
    claimedSpots,
    remainingSpots: remaining,
    isOpen: Boolean(data.is_open) && remaining > 0,
    pricingNote:
      data.pricing_note ||
      "Founding pricing locked for life for the first 100 doctors who register.",
  };
}

/**
 * Claim a founding spot for a newly registered doctor.
 * Non-blocking for registration success — logs and returns null if full/error.
 */
export async function claimFoundingMembership(
  doctorId: string
): Promise<{ foundingNumber: number | null; claimed: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("claim_founding_member", {
      p_doctor_id: doctorId,
    });

    if (error) {
      log.error("[Founding] claim_founding_member failed", {
        err: error,
        doctorId,
      });
      return { foundingNumber: null, claimed: false };
    }

    const foundingNumber =
      typeof data === "number"
        ? data
        : data != null
          ? Number(data)
          : null;

    if (foundingNumber && Number.isFinite(foundingNumber) && foundingNumber > 0) {
      return { foundingNumber, claimed: true };
    }
    return { foundingNumber: null, claimed: false };
  } catch (err) {
    log.error("[Founding] claim exception", { err, doctorId });
    return { foundingNumber: null, claimed: false };
  }
}

/** True when a 7-digit GMC number is present (UK). */
export function isValidGmcNumber(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\d{7}$/.test(value.trim());
}
