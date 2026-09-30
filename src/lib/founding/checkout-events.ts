/**
 * Licence Checkout success and expiry. Claim and the doctor welcome email
 * run only after payment. An expired session releases a pending hold.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDoctorWelcomeOnce } from "@/lib/email/doctor-welcome-once";
import { futureFeaturedUntil } from "@/lib/founding/spot-lifecycle";
import {
  claimFoundingSpotOnPayment,
  releaseFoundingSpotReservation,
  unixToIso,
} from "@/lib/founding/spots";
import { log } from "@/lib/utils/logger";

type LicenseSession = {
  id: string;
  mode?: string | null;
  subscription?: string | { id?: string | null } | null;
  metadata?: {
    type?: string | null;
    tier?: string | null;
    founding_offer?: string | null;
    doctor_id?: string | null;
  } | null;
};

/** Period end from the Checkout subscription. Missing or past leaves featured off. */
export async function featuredUntilForLicenseSession(
  session: LicenseSession
): Promise<string | null> {
  const subscription = session.subscription;
  const subId =
    typeof subscription === "string" ? subscription : subscription?.id ?? null;
  if (!subId) return null;
  try {
    const stripe = (await import("@/lib/stripe/client")).getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const raw = sub as unknown as {
      current_period_end?: number;
      items?: { data?: Array<{ current_period_end?: number }> };
    };
    const unix =
      raw.current_period_end ?? raw.items?.data?.[0]?.current_period_end;
    return futureFeaturedUntil(unixToIso(unix));
  } catch (err) {
    log.error("[Founding] subscription period end lookup failed", {
      err,
      sessionId: session.id,
    });
    return null;
  }
}

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
      featuredUntil: await featuredUntilForLicenseSession(session),
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
