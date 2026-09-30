/**
 * Checkout may reserve a founding spot. It must not claim one.
 * Payment success claims, in the Stripe webhook.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FOUNDING_OFFER_CLOSED_ERROR,
  FOUNDING_OFFER_FORFEIT_ERROR,
  canResubscribeFoundingOffer,
} from "@/lib/founding/offer";
import { reserveFoundingSpotForSession as reserveSpot } from "@/lib/founding/spots";

export async function assertFoundingCheckoutAllowed(
  doctorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  return { ok: true };
}

export async function reserveFoundingSpotForSession(
  doctorId: string,
  sessionId: string,
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = supabase ?? createAdminClient();
  return reserveSpot(admin, doctorId, sessionId);
}

export async function foundingDoctorIdForOrg(
  organizationId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: doctors } = await admin
    .from("doctors")
    .select("id, founding_offer_forfeited_at")
    .eq("organization_id", organizationId)
    .limit(5);

  if (!doctors?.length) return null;
  if (
    doctors.some(
      (doctor) =>
        !canResubscribeFoundingOffer({
          forfeitedAt: doctor.founding_offer_forfeited_at,
        })
    )
  ) {
    return null;
  }
  return doctors[0].id;
}

export async function assertFoundingCheckoutAllowedForOrg(
  organizationId: string
): Promise<
  { ok: true; doctorId: string } | { ok: false; error: string }
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

  const gate = await assertFoundingCheckoutAllowed(doctors[0].id);
  if (!gate.ok) return gate;
  return { ok: true, doctorId: doctors[0].id };
}

export { FOUNDING_OFFER_CLOSED_ERROR };
