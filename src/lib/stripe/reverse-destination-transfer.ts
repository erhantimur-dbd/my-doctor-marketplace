/**
 * Pull Connect destination-charge funds back to the platform without
 * refunding the patient's card. Used when cancelling into wallet credit.
 */

import { getStripe } from "@/lib/stripe/client";
import { findDestinationTransfer } from "@/lib/stripe/transfer-handoff";
import { log } from "@/lib/utils/logger";

export async function reverseDestinationTransferToPlatform(input: {
  paymentIntentId: string;
  connectedAccountId?: string | null;
  amountCents: number;
  bookingId: string;
  reason?: string;
}): Promise<{ ok: boolean; reversalId?: string; error?: string }> {
  const { paymentIntentId, connectedAccountId, amountCents, bookingId, reason } =
    input;

  if (amountCents <= 0) {
    return { ok: true };
  }

  try {
    const found = await findDestinationTransfer(
      paymentIntentId,
      connectedAccountId || undefined
    );

    if (!found) {
      // Platform may already hold the funds (incomplete Connect / Softsmoke).
      log.error("[ReverseTransfer] No destination transfer found", {
        paymentIntentId,
        bookingId,
      });
      return { ok: true };
    }

    const reverseAmount = Math.min(amountCents, found.amount);
    if (reverseAmount <= 0) {
      return { ok: true };
    }

    const stripe = getStripe();
    const reversal = await stripe.transfers.createReversal(
      found.transferId,
      {
        amount: reverseAmount,
        metadata: {
          booking_id: bookingId,
          type: reason || "wallet_refund_reversal",
        },
      },
      { idempotencyKey: `wallet-refund-rev-${bookingId}-${reverseAmount}` }
    );

    return { ok: true, reversalId: reversal.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transfer reversal failed";
    log.error("[ReverseTransfer] Failed", {
      err,
      paymentIntentId,
      bookingId,
    });
    return { ok: false, error: message };
  }
}
