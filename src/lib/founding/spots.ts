/**
 * Founding spot persistence. Claim runs from the Stripe subscription
 * webhook after payment. Checkout only reserves.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";
import {
  FOUNDING_OFFER_CLOSED_ERROR,
  mayGrantFoundingLicence,
} from "@/lib/founding/offer";

export async function reserveFoundingSpotForSession(
  supabase: SupabaseClient,
  doctorId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("reserve_founding_spot", {
    p_doctor_id: doctorId,
    p_checkout_session_id: sessionId,
  });
  if (error) {
    log.error("[Founding] reserve_founding_spot failed", { err: error, doctorId });
    return { ok: false, error: FOUNDING_OFFER_CLOSED_ERROR };
  }
  if (data !== true) {
    return { ok: false, error: FOUNDING_OFFER_CLOSED_ERROR };
  }
  return { ok: true };
}

export async function releaseFoundingSpotReservation(
  supabase: SupabaseClient,
  input: { checkoutSessionId?: string | null; doctorId?: string | null }
): Promise<void> {
  const { error } = await supabase.rpc("release_founding_spot_reservation", {
    p_checkout_session_id: input.checkoutSessionId ?? null,
    p_doctor_id: input.doctorId ?? null,
  });
  if (error) {
    log.error("[Founding] release_founding_spot_reservation failed", {
      err: error,
      doctorId: input.doctorId,
      checkoutSessionId: input.checkoutSessionId,
    });
  }
}

export async function claimFoundingSpotOnPayment(
  supabase: SupabaseClient,
  input: { doctorId: string; featuredUntil: string | null }
): Promise<{ claimed: boolean; foundingNumber: number | null }> {
  const { data, error } = await supabase.rpc("claim_founding_member", {
    p_doctor_id: input.doctorId,
    p_featured_until: input.featuredUntil,
  });
  if (error) {
    log.error("[Founding] claim_founding_member failed", {
      err: error,
      doctorId: input.doctorId,
    });
    return { claimed: false, foundingNumber: null };
  }
  const foundingNumber =
    typeof data === "number" ? data : data != null ? Number(data) : null;
  const claim = {
    claimed:
      foundingNumber != null &&
      Number.isFinite(foundingNumber) &&
      foundingNumber > 0,
    foundingNumber:
      foundingNumber != null && Number.isFinite(foundingNumber)
        ? foundingNumber
        : null,
  };
  if (!mayGrantFoundingLicence(claim)) {
    return { claimed: false, foundingNumber: null };
  }
  return claim;
}

/** Clear featured when the founding subscription ends. Uses that subscription's timestamp. */
export async function endFoundingFeatured(
  supabase: SupabaseClient,
  input: {
    doctorId?: string | null;
    organizationId?: string | null;
    featuredUntil: string;
  }
): Promise<void> {
  const patch = {
    is_featured: false,
    featured_until: input.featuredUntil,
  };
  if (input.doctorId) {
    const { error } = await supabase
      .from("doctors")
      .update(patch)
      .eq("id", input.doctorId);
    if (error) {
      log.error("[Founding] end featured failed", { err: error, doctorId: input.doctorId });
    }
    return;
  }
  if (input.organizationId) {
    const { error } = await supabase
      .from("doctors")
      .update(patch)
      .eq("organization_id", input.organizationId);
    if (error) {
      log.error("[Founding] end featured failed", {
        err: error,
        organizationId: input.organizationId,
      });
    }
  }
}

export function unixToIso(unix: number | null | undefined): string | null {
  if (unix == null || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString();
}
