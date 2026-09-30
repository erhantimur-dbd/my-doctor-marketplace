/**
 * Claim a founding spot before any £99 checkout. A failed claim or a
 * previous cancel blocks the licence.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { claimFoundingMembership } from "@/lib/founding/members";
import {
  FOUNDING_OFFER_CLOSED_ERROR,
  FOUNDING_OFFER_FORFEIT_ERROR,
  canResubscribeFoundingOffer,
  mayGrantFoundingLicence,
} from "@/lib/founding/offer";

export async function claimFoundingOfferForCheckout(
  doctorId: string
): Promise<
  { ok: true; foundingNumber: number } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("doctors")
    .select("founding_offer_forfeited_at")
    .eq("id", doctorId)
    .maybeSingle();

  if (
    !canResubscribeFoundingOffer({
      forfeitedAt: data?.founding_offer_forfeited_at ?? null,
    })
  ) {
    return { ok: false, error: FOUNDING_OFFER_FORFEIT_ERROR };
  }

  const claim = await claimFoundingMembership(doctorId);
  if (!mayGrantFoundingLicence(claim) || claim.foundingNumber == null) {
    return { ok: false, error: FOUNDING_OFFER_CLOSED_ERROR };
  }

  return { ok: true, foundingNumber: claim.foundingNumber };
}

export async function claimFoundingOfferForOrg(
  organizationId: string
): Promise<
  { ok: true; foundingNumber: number } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: doctors } = await admin
    .from("doctors")
    .select("id, founding_offer_forfeited_at")
    .eq("organization_id", organizationId)
    .limit(5);

  if (!doctors?.length) {
    return { ok: false, error: "No doctor found for this practice." };
  }

  if (
    doctors.some(
      (doctor) =>
        !canResubscribeFoundingOffer({
          forfeitedAt: doctor.founding_offer_forfeited_at,
        })
    )
  ) {
    return { ok: false, error: FOUNDING_OFFER_FORFEIT_ERROR };
  }

  return claimFoundingOfferForCheckout(doctors[0].id);
}
