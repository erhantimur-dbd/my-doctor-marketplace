/**
 * Persist the destination-charge ids from a paid consult PaymentIntent.
 *
 * bookings.stripe_charge_id and bookings.stripe_destination_transfer_id are
 * written once, at payment confirmation. Charge-skip and £0 bookings have no
 * PaymentIntent, so this is a no-op for them. A later call does not overwrite
 * ids that are already stored.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/client";
import { log } from "@/lib/utils/logger";

export interface DestinationChargeIds {
  chargeId: string | null;
  transferId: string | null;
}

type ExpandedCharge = {
  id?: string | null;
  transfer?: string | { id?: string | null } | null;
};

export interface PaymentIntentChargeClient {
  paymentIntents: {
    retrieve(
      id: string,
      params?: { expand?: string[] }
    ): Promise<{
      latest_charge?: string | ExpandedCharge | null;
    }>;
  };
}

export function paymentIntentIdFromStripe(
  paymentIntent: string | { id?: string | null } | null | undefined
): string | null {
  if (!paymentIntent) return null;
  if (typeof paymentIntent === "string") return paymentIntent || null;
  return paymentIntent.id ?? null;
}

/**
 * PaymentIntent.latest_charge plus that charge's destination transfer.
 * A string latest_charge is an unexpanded id (no transfer). An expanded
 * charge may carry transfer as an id or an object.
 */
export function destinationChargeIdsFromPaymentIntent(paymentIntent: {
  latest_charge?: string | ExpandedCharge | null;
}): DestinationChargeIds {
  const latest = paymentIntent.latest_charge;
  if (!latest) return { chargeId: null, transferId: null };
  if (typeof latest === "string") {
    return { chargeId: latest || null, transferId: null };
  }
  const transfer = latest.transfer;
  const transferId =
    typeof transfer === "string" ? transfer || null : transfer?.id ?? null;
  return { chargeId: latest.id || null, transferId };
}

/** Only fill columns that are still empty. Never clear a stored id. */
export function bookingDestinationChargePatch(input: {
  existingChargeId?: string | null;
  existingTransferId?: string | null;
  chargeId: string | null;
  transferId: string | null;
}): {
  stripe_charge_id?: string;
  stripe_destination_transfer_id?: string;
} | null {
  const patch: {
    stripe_charge_id?: string;
    stripe_destination_transfer_id?: string;
  } = {};
  if (!input.existingChargeId && input.chargeId) {
    patch.stripe_charge_id = input.chargeId;
  }
  if (!input.existingTransferId && input.transferId) {
    patch.stripe_destination_transfer_id = input.transferId;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function loadDestinationChargeIds(
  paymentIntentId: string,
  stripe: PaymentIntentChargeClient
): Promise<DestinationChargeIds> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge", "latest_charge.transfer"],
  });
  return destinationChargeIdsFromPaymentIntent(paymentIntent);
}

/**
 * Read the PaymentIntent and store missing charge/transfer ids.
 * Failures are logged and swallowed so a Stripe lookup cannot roll back
 * a booking that is already confirmed.
 */
export async function persistBookingDestinationChargeIds(input: {
  bookingId: string;
  paymentIntentId?: string | null;
  supabase: SupabaseClient;
  stripe?: PaymentIntentChargeClient;
}): Promise<void> {
  if (!input.paymentIntentId) return;

  try {
    const { data, error } = await input.supabase
      .from("bookings")
      .select("stripe_charge_id, stripe_destination_transfer_id")
      .eq("id", input.bookingId)
      .maybeSingle();

    if (error) {
      log.error("[destination-charge] booking lookup failed", {
        err: error,
        bookingId: input.bookingId,
      });
      return;
    }

    const existingChargeId = data?.stripe_charge_id ?? null;
    const existingTransferId = data?.stripe_destination_transfer_id ?? null;
    if (existingChargeId && existingTransferId) return;

    const stripe =
      input.stripe ?? (getStripe() as unknown as PaymentIntentChargeClient);
    const ids = await loadDestinationChargeIds(input.paymentIntentId, stripe);
    const patch = bookingDestinationChargePatch({
      existingChargeId,
      existingTransferId,
      chargeId: ids.chargeId,
      transferId: ids.transferId,
    });
    if (!patch) return;

    const { error: updateError } = await input.supabase
      .from("bookings")
      .update(patch)
      .eq("id", input.bookingId);

    if (updateError) {
      log.error("[destination-charge] failed to store charge ids", {
        err: updateError,
        bookingId: input.bookingId,
      });
    }
  } catch (err) {
    log.error("[destination-charge] payment intent lookup failed", {
      err,
      bookingId: input.bookingId,
      paymentIntentId: input.paymentIntentId,
    });
  }
}
