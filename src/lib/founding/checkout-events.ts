/**
 * Licence Checkout success and expiry. Claim and the doctor welcome email
 * run only after payment. An expired session releases a pending hold.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDoctorWelcomeOnce } from "@/lib/email/doctor-welcome-once";
import {
  claimFoundingSpotOnPayment,
  releaseFoundingSpotReservation,
} from "@/lib/founding/spots";

type LicenseSession = {
  id: string;
  mode?: string | null;
  metadata?: {
    type?: string | null;
    tier?: string | null;
    founding_offer?: string | null;
    doctor_id?: string | null;
  } | null;
};

export function isFoundingLicenseMetadata(
  metadata: LicenseSession["metadata"]
): boolean {
  return metadata?.tier === "founding" || metadata?.founding_offer === "1";
}

export async function onLicenseCheckoutCompleted(
  supabase: SupabaseClient,
  session: LicenseSession
): Promise<void> {
  if (session.mode !== "subscription") return;
  if (session.metadata?.type !== "license") return;
  const doctorId = session.metadata.doctor_id;
  if (!doctorId) return;

  if (isFoundingLicenseMetadata(session.metadata)) {
    const claim = await claimFoundingSpotOnPayment(supabase, {
      doctorId,
      featuredUntil: null,
    });
    if (!claim.claimed) return;
  }

  await sendDoctorWelcomeOnce(doctorId);
}

export async function onLicenseCheckoutExpired(
  supabase: SupabaseClient,
  session: LicenseSession
): Promise<void> {
  if (session.mode !== "subscription") return;
  if (session.metadata?.type !== "license") return;
  if (!isFoundingLicenseMetadata(session.metadata)) return;
  await releaseFoundingSpotReservation(supabase, {
    checkoutSessionId: session.id,
    doctorId: session.metadata.doctor_id,
  });
}
