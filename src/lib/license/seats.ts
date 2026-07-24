/**
 * Doctor seat capacity — Solo plans (Free/Starter/Pro = 1) vs Clinic (3–15).
 * Distinct from referrals (independent accounts, zero seat impact).
 */

import type { LicenseTierConfig } from "@/lib/constants/license-tiers";
import { getLicenseTier } from "@/lib/constants/license-tiers";
import type { LicenseLike } from "@/lib/license/tier-lifecycle";
import { isPaidTier, pickEffectiveLicense } from "@/lib/license/tier-lifecycle";

export type MemberLike = {
  role: string;
  status: string;
};

export type InviteLike = {
  role: string;
  status: string;
};

/** Roles that consume a billed doctor seat */
export function roleConsumesDoctorSeat(role: string): boolean {
  return role === "doctor" || role === "owner";
}

/**
 * Active members who count toward doctor seats.
 * Owner counts only when they are a practising doctor-owner (role owner is
 * counted if they occupy the primary seat — typically owner is doctor on Pro).
 * Plan: count role doctor; also owner when owner acts as doctor (owner counted
 * once via role doctor OR owner if no separate doctor member for same person —
 * simpler: count role === "doctor" OR role === "owner" for seat inventory of
 * clinical capacity, matching product "doctor seats").
 */
export function countDoctorSeatsUsed(members: MemberLike[]): number {
  return members.filter(
    (m) =>
      m.status === "active" &&
      (m.role === "doctor" || m.role === "owner")
  ).length;
}

/** Pending clinic invitations that soft-reserve doctor capacity */
export function countPendingDoctorInvites(invites: InviteLike[]): number {
  return invites.filter(
    (i) => i.status === "pending" && i.role === "doctor"
  ).length;
}

export function getSeatCapacityFromLicense(
  license: { max_seats?: number; tier?: string } | null | undefined
): number {
  if (!license) return 1;
  if (typeof license.max_seats === "number" && license.max_seats > 0) {
    return license.max_seats;
  }
  const tierConfig = license.tier ? getLicenseTier(license.tier) : undefined;
  return tierConfig?.maxSeats ?? 1;
}

export function getTierSeatLimits(tierId: string | null | undefined): {
  min: number;
  max: number;
  included: number;
  perUser: boolean;
  multiDoctor: boolean;
} {
  const config = tierId ? getLicenseTier(tierId) : undefined;
  if (!config || config.isFreeTier) {
    return { min: 1, max: 1, included: 1, perUser: false, multiDoctor: false };
  }
  if (config.id === "starter" || config.id === "professional") {
    // Solo plans: one doctor only; multi-doctor is Clinic
    return {
      min: 1,
      max: 1,
      included: 1,
      perUser: false,
      multiDoctor: false,
    };
  }
  return {
    min: config.defaultSeats,
    max: config.maxSeats,
    included: config.includedSeats,
    perUser: !!config.perUser,
    multiDoctor: config.maxSeats > 1,
  };
}

export type SeatInviteCheck = {
  allowed: boolean;
  reason?: string;
  used: number;
  pending: number;
  max: number;
  remaining: number;
  multiDoctor: boolean;
  tier: string | null;
};

/**
 * Soft-cap: used + pending doctor invites must be < max to send another doctor invite.
 * Admin/staff invites do not use this check.
 */
export function canInviteDoctor(params: {
  members: MemberLike[];
  pendingInvites: InviteLike[];
  license: LicenseLike | null | undefined;
  /** role being invited */
  role: string;
}): SeatInviteCheck {
  const tier = params.license?.tier ?? null;
  const limits = getTierSeatLimits(tier);
  const used = countDoctorSeatsUsed(params.members);
  const pending = countPendingDoctorInvites(params.pendingInvites);
  const max = getSeatCapacityFromLicense(
    params.license
      ? {
          max_seats: params.license.max_seats ?? undefined,
          tier: tier ?? undefined,
        }
      : null
  );
  const remaining = Math.max(0, max - used - pending);

  if (!roleConsumesDoctorSeat(params.role) && params.role !== "doctor") {
    // admin/staff
    return {
      allowed: true,
      used,
      pending,
      max,
      remaining,
      multiDoctor: limits.multiDoctor,
      tier,
    };
  }

  if (!params.license || !isPaidTier(tier)) {
    return {
      allowed: false,
      reason:
        "Multi-doctor seats require Professional or Clinic. Use Referrals to invite colleagues to their own account, or upgrade your plan.",
      used,
      pending,
      max,
      remaining: 0,
      multiDoctor: false,
      tier,
    };
  }

  if (!limits.multiDoctor && params.role === "doctor") {
    return {
      allowed: false,
      reason:
        "Your plan includes one doctor seat. Upgrade to Professional (up to 4) or Clinic (up to 15), or use Referrals for independent accounts.",
      used,
      pending,
      max,
      remaining: 0,
      multiDoctor: false,
      tier,
    };
  }

  if (used + pending >= max) {
    return {
      allowed: false,
      reason:
        max >= limits.max
          ? `All ${max} doctor seats are in use or invited. ${
              tier === "clinic" || tier === "enterprise"
                ? "Add extra seats from Billing if under 15, or contact us for Enterprise."
                : "Multi-doctor practices use Clinic (3–15 seats). Or use Referrals for independent accounts."
            }`
          : "No free doctor seats. Add a seat from Billing first.",
      used,
      pending,
      max,
      remaining: 0,
      multiDoctor: limits.multiDoctor,
      tier,
    };
  }

  return {
    allowed: true,
    used,
    pending,
    max,
    remaining,
    multiDoctor: limits.multiDoctor,
    tier,
  };
}

export function pickLicenseForSeats(
  licenses: LicenseLike[]
): LicenseLike | null {
  return pickEffectiveLicense(licenses);
}

/**
 * @deprecated Professional is flat 1-seat; multi-doctor is Clinic only.
 * Kept for callers that still clamp seat counts to a single doctor.
 */
export function professionalQuantityFromSeats(maxSeats: number): number {
  void maxSeats;
  return 1;
}

/**
 * Recompute used_seats from live membership (source of truth).
 * Call after accept/remove/role change. Returns the new count.
 */
export function computeUsedSeatsFromMembers(members: MemberLike[]): number {
  return countDoctorSeatsUsed(members);
}
