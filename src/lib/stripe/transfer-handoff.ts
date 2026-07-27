/**
 * Move Connect destination-charge funds from one doctor to another
 * when a GP booking is reassigned (no patient refund).
 *
 * Flow:
 * 1. Find the transfer on the PaymentIntent's charge to the old account
 * 2. Reverse that transfer (pulls funds back to platform)
 * 3. Create a new transfer to the replacement doctor's connected account
 */

import { getStripe } from "@/lib/stripe/client";
import { log } from "@/lib/utils/logger";

export interface TransferHandoffInput {
  paymentIntentId: string;
  fromAccountId: string;
  toAccountId: string;
  /** Doctor net amount to move (usually charge amount minus application fee) */
  amountCents: number;
  currency: string;
  bookingId: string;
  idempotencyKey?: string;
}

export interface TransferHandoffResult {
  success: boolean;
  reversedTransferId?: string;
  reversalId?: string;
  newTransferId?: string;
  error?: string;
}

/**
 * Resolve the destination transfer attached to a PaymentIntent charge.
 */
export async function findDestinationTransfer(
  paymentIntentId: string,
  expectedDestination?: string
): Promise<{ transferId: string; amount: number; currency: string } | null> {
  const stripe = getStripe();

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge", "latest_charge.transfer"],
  });

  const charge =
    typeof pi.latest_charge === "object" && pi.latest_charge
      ? pi.latest_charge
      : null;

  if (!charge) return null;

  // Expanded transfer on charge (destination charges)
  const expandedTransfer =
    typeof (charge as { transfer?: unknown }).transfer === "object"
      ? ((charge as { transfer?: { id: string; amount: number; currency: string; destination?: string | { id: string } | null } }).transfer ?? null)
      : null;

  if (expandedTransfer?.id) {
    const dest =
      typeof expandedTransfer.destination === "string"
        ? expandedTransfer.destination
        : expandedTransfer.destination?.id;
    if (!expectedDestination || dest === expectedDestination) {
      return {
        transferId: expandedTransfer.id,
        amount: expandedTransfer.amount,
        currency: expandedTransfer.currency,
      };
    }
  }

  // Fallback: list transfers by source_transaction (charge id)
  const list = await stripe.transfers.list({
    transfer_group: pi.transfer_group || undefined,
    limit: 20,
  });

  // Also try source_transaction filter
  const bySource = await stripe.transfers.list({
    // @ts-expect-error — source_transaction is valid API param
    source_transaction: charge.id,
    limit: 10,
  });

  const candidates = [...list.data, ...bySource.data];
  const match = candidates.find((t) => {
    const dest =
      typeof t.destination === "string" ? t.destination : t.destination;
    if (expectedDestination && dest !== expectedDestination) return false;
    return t.amount > 0 && !t.reversed;
  });

  if (!match) return null;

  return {
    transferId: match.id,
    amount: match.amount,
    currency: match.currency,
  };
}

/**
 * Reverse old doctor transfer and create transfer to new doctor.
 * Does NOT refund the patient.
 */
export async function handoffConnectTransfer(
  input: TransferHandoffInput
): Promise<TransferHandoffResult> {
  const {
    paymentIntentId,
    fromAccountId,
    toAccountId,
    amountCents,
    currency,
    bookingId,
    idempotencyKey,
  } = input;

  if (amountCents <= 0) {
    return { success: false, error: "Invalid handoff amount" };
  }
  if (fromAccountId === toAccountId) {
    return { success: true }; // nothing to move
  }

  const stripe = getStripe();
  const keyBase =
    idempotencyKey || `gp-reassign-${bookingId}-${toAccountId}`;

  try {
    const found = await findDestinationTransfer(
      paymentIntentId,
      fromAccountId
    );

    if (!found) {
      // No transfer found — try moving full amount as new transfer only if platform holds funds
      log.error("[TransferHandoff] No destination transfer found", {
        paymentIntentId,
        fromAccountId,
        bookingId,
      });
      return {
        success: false,
        error:
          "Could not locate the original doctor transfer. Funds may already be paid out.",
      };
    }

    const reverseAmount = Math.min(amountCents, found.amount);

    const reversal = await stripe.transfers.createReversal(
      found.transferId,
      {
        amount: reverseAmount,
        metadata: {
          booking_id: bookingId,
          type: "gp_reassignment_reversal",
          to_account: toAccountId,
        },
      },
      { idempotencyKey: `${keyBase}-reverse` }
    );

    const newTransfer = await stripe.transfers.create(
      {
        amount: reverseAmount,
        currency: (currency || found.currency).toLowerCase(),
        destination: toAccountId,
        metadata: {
          booking_id: bookingId,
          type: "gp_reassignment",
          from_account: fromAccountId,
          reversed_transfer: found.transferId,
        },
      },
      { idempotencyKey: `${keyBase}-create` }
    );

    return {
      success: true,
      reversedTransferId: found.transferId,
      reversalId: reversal.id,
      newTransferId: newTransfer.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transfer handoff failed";
    log.error("[TransferHandoff] Failed", {
      err,
      paymentIntentId,
      bookingId,
      fromAccountId,
      toAccountId,
    });
    return { success: false, error: message };
  }
}

/**
 * Doctor net from a destination charge = charged amount − application fee.
 * Prefer explicit values from booking when available.
 */
export function doctorNetFromBooking(booking: {
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents: number;
  platform_fee_cents?: number | null;
  commission_cents?: number | null;
}): number {
  const charged =
    booking.payment_mode === "deposit" && booking.deposit_amount_cents != null
      ? booking.deposit_amount_cents
      : booking.total_amount_cents;
  const fees =
    (booking.platform_fee_cents || 0) + (booking.commission_cents || 0);
  // Application fee was min(commission, charged) at checkout; approximate doctor net
  const appFee = Math.min(fees || Math.round(charged * 0.15), charged);
  return Math.max(0, charged - appFee);
}
