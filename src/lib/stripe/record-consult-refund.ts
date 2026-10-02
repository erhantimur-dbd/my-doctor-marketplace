/**
 * Persist a consult refund on the booking.
 *
 * Every path that moves consult money (admin refund, admin cancel, patient
 * cancel, cancel-and-rebook, clinic cancel, cheaper clinic reschedule, GP
 * reassignment refund) writes the counters through here. The write uses the
 * service-role client because bookings has no UPDATE policy for the logged-in
 * user, and a zero-row update is an error.
 *
 * Idempotency is per Stripe refund id. The id is claimed in
 * `processed_webhook_events` (existing unique `event_id`, no new column)
 * before the booking update. A retry, or a later `charge.refunded` delivery
 * that called this helper, sees the claim and does not add the cents again.
 * Wallet-only refunds have no Stripe refund id; they claim a key of booking,
 * prior refunded total, and the split amounts. The claim is released if the
 * booking update does not land, so a retry can still record it.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { bookingRowUpdateError } from "@/lib/booking/booking-row-update";
import { log } from "@/lib/utils/logger";
import {
  bookingRefundSettlementPatch,
  storedConsultPaidParts,
  type ConsultRefundResult,
} from "@/lib/stripe/consult-refund";
import { restoreAppliedOffsetForRefund } from "@/lib/payments/payout-offset-store";
import {
  assignCustomerRefundCode,
  customerRefundCodeOnReplay,
} from "@/lib/payments/customer-refund-code";

export const CONSULT_REFUND_LEDGER_EVENT_TYPE = "consult_refund_recorded";

export type RecordedConsultRefund = Pick<
  ConsultRefundResult,
  | "cardRefundedToCardCents"
  | "creditRefundCents"
  | "walletCreditCents"
  | "alreadyApplied"
  | "cardRefundId"
> & { cardRefundCents?: number };

export interface ConsultRefundBookingWriter {
  claim(eventId: string): Promise<"claimed" | "duplicate">;
  release(eventId: string): Promise<void>;
  updateBooking(
    bookingId: string,
    patch: Record<string, unknown>
  ): Promise<{
    error: { message?: string; code?: string } | null;
    rows: { id: string }[] | null;
  }>;
}

export function consultRefundLedgerKeys(input: {
  stripeRefundId?: string | null;
  bookingId: string;
  alreadyRefundedCents: number;
  cardRefundedToCardCents: number;
  walletCreditCents: number;
  creditRefundCents: number;
}): string[] {
  const amountKey = [
    "consult-refund",
    input.bookingId,
    `prior-${Math.max(0, Math.round(input.alreadyRefundedCents))}`,
    `card-${Math.max(0, Math.round(input.cardRefundedToCardCents))}`,
    `wallet-${Math.max(0, Math.round(input.walletCreditCents))}`,
    `credit-${Math.max(0, Math.round(input.creditRefundCents))}`,
  ].join(":");
  const stripeId = input.stripeRefundId?.trim() || "";
  if (!stripeId) return [amountKey];
  // Stripe id first so a retry that still has re_… hits the same row.
  // The amount key catches the wallet early-return, which drops the id.
  return [`consult-refund:${stripeId}`, amountKey];
}

function moneyMoved(settled: RecordedConsultRefund | null | undefined): boolean {
  if (!settled) return false;
  return (
    (settled.cardRefundedToCardCents || 0) > 0 ||
    (settled.walletCreditCents || 0) > 0 ||
    (settled.creditRefundCents || 0) > 0
  );
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message || "");
}

export function defaultConsultRefundBookingWriter(): ConsultRefundBookingWriter {
  const supabase = createAdminClient();
  return {
    async claim(eventId) {
      const { error } = await supabase.from("processed_webhook_events").insert({
        event_id: eventId,
        event_type: CONSULT_REFUND_LEDGER_EVENT_TYPE,
      });
      if (!error) return "claimed";
      if (isUniqueViolation(error)) return "duplicate";
      throw new Error(error.message);
    },
    async release(eventId) {
      const { error } = await supabase
        .from("processed_webhook_events")
        .delete()
        .eq("event_id", eventId);
      if (error) {
        log.error("Could not release consult refund ledger claim", {
          eventId,
          err: error,
        });
      }
    },
    async updateBooking(bookingId, patch) {
      const { data, error } = await supabase
        .from("bookings")
        .update(patch)
        .eq("id", bookingId)
        .select("id");
      return { error, rows: data };
    },
  };
}

async function releaseAll(
  writer: ConsultRefundBookingWriter,
  eventIds: readonly string[]
): Promise<void> {
  for (const eventId of eventIds) {
    try {
      await writer.release(eventId);
    } catch (err) {
      log.error("Could not release consult refund ledger claim", {
        eventId,
        err,
      });
    }
  }
}

export type RestoreOffsetForRefund = (input: {
  bookingId: string;
  refundId: string;
  refundCents: number;
  originalPaidCents: number;
}) => Promise<number>;

function refundCentsOf(settled: RecordedConsultRefund): number {
  return (
    (settled.cardRefundCents ??
      (settled.cardRefundedToCardCents || 0) +
        Math.max(
          0,
          (settled.walletCreditCents || 0) - (settled.creditRefundCents || 0)
        )) + (settled.creditRefundCents || 0)
  );
}

export async function recordConsultRefundOnBooking(
  input: {
    bookingId: string;
    booking: Parameters<typeof bookingRefundSettlementPatch>[0] & {
      refund_amount_cents?: number | null;
      booking_number?: string | null;
      customer_refund_codes?: unknown;
    };
    /** Null when this cancel moves no money and only the extra columns change. */
    settled?: RecordedConsultRefund | null;
    /** Admin refund sets status to refunded once the original paid total is settled. */
    markStatusRefunded?: boolean;
    /**
     * Written in the same UPDATE. Spread after the money patch so a cancel
     * status (cancelled_patient / cancelled_doctor) is kept on a full refund.
     */
    extra?: Record<string, unknown>;
    /**
     * Cheaper clinic reschedule rebases paid parts instead of accumulating
     * the part counters. Still claimed once per Stripe refund id.
     */
    patchOverride?: Record<string, unknown> | null;
  },
  deps?: {
    writer?: ConsultRefundBookingWriter;
    restoreOffset?: RestoreOffsetForRefund;
  }
): Promise<
  | { error: string }
  | {
      alreadyRecorded: boolean;
      patch: Record<string, unknown> | null;
      customerRefundCode: string | null;
    }
> {
  const writer = deps?.writer ?? defaultConsultRefundBookingWriter();
  const settled = input.settled ?? null;
  const moved = moneyMoved(settled);
  const extra = input.extra ?? {};

  const moneyPatch = moved
    ? input.patchOverride != null
      ? input.patchOverride
      : bookingRefundSettlementPatch(input.booking, settled!, {
          markStatusRefunded: input.markStatusRefunded,
        })
    : null;

  const patch: Record<string, unknown> = {
    ...(moneyPatch ?? {}),
    ...extra,
  };

  if (!moved) {
    if (Object.keys(patch).length === 0) {
      return { alreadyRecorded: false, patch: null, customerRefundCode: null };
    }
    const updated = await writer.updateBooking(input.bookingId, patch);
    const rowError = bookingRowUpdateError({
      error: updated.error,
      rows: updated.rows,
      stripeRefundSucceeded: false,
      bookingId: input.bookingId,
    });
    if (rowError) return rowError;
    return { alreadyRecorded: false, patch, customerRefundCode: null };
  }

  const keys = consultRefundLedgerKeys({
    stripeRefundId: settled?.cardRefundId,
    bookingId: input.bookingId,
    alreadyRefundedCents: Number(input.booking.refund_amount_cents || 0),
    cardRefundedToCardCents: settled?.cardRefundedToCardCents || 0,
    walletCreditCents: settled?.walletCreditCents || 0,
    creditRefundCents: settled?.creditRefundCents || 0,
  });

  const claimed: string[] = [];
  try {
    for (const key of keys) {
      const claim = await writer.claim(key);
      if (claim === "duplicate") {
        await releaseAll(writer, claimed);
        return {
          alreadyRecorded: true,
          patch: null,
          customerRefundCode: customerRefundCodeOnReplay({
            bookingNumber: input.booking.booking_number,
            existing: input.booking.customer_refund_codes,
            stripeRefundId: settled?.cardRefundId,
          }),
        };
      }
      claimed.push(key);
    }
  } catch (err) {
    await releaseAll(writer, claimed);
    log.error("Consult refund ledger claim failed", {
      bookingId: input.bookingId,
      stripeRefundId: settled?.cardRefundId ?? null,
      err,
    });
    return bookingRowUpdateError({
      error: err instanceof Error ? err : { message: "ledger claim failed" },
      rows: [],
      stripeRefundSucceeded: true,
      bookingId: input.bookingId,
      stripeRefundId: settled?.cardRefundId,
    })!;
  }

  const assigned = assignCustomerRefundCode({
    bookingNumber: input.booking.booking_number || "",
    existing: input.booking.customer_refund_codes,
    stripeRefundId: settled?.cardRefundId,
    amountCents: refundCentsOf(settled!),
  });
  const customerRefundCode = assigned?.code ?? null;
  if (assigned) {
    patch.customer_refund_codes = assigned.codes;
  }

  if (Object.keys(patch).length === 0) {
    return { alreadyRecorded: true, patch: null, customerRefundCode };
  }

  let updated: Awaited<ReturnType<ConsultRefundBookingWriter["updateBooking"]>>;
  try {
    updated = await writer.updateBooking(input.bookingId, patch);
  } catch (err) {
    await releaseAll(writer, claimed);
    log.error("Consult refund booking update threw", {
      bookingId: input.bookingId,
      stripeRefundId: settled?.cardRefundId ?? null,
      err,
    });
    return bookingRowUpdateError({
      error: err instanceof Error ? err : { message: "booking update failed" },
      rows: [],
      stripeRefundSucceeded: true,
      bookingId: input.bookingId,
      stripeRefundId: settled?.cardRefundId,
    })!;
  }

  const rowError = bookingRowUpdateError({
    error: updated.error,
    rows: updated.rows,
    stripeRefundSucceeded: true,
    bookingId: input.bookingId,
    stripeRefundId: settled?.cardRefundId,
  });
  if (rowError) {
    await releaseAll(writer, claimed);
    return rowError;
  }

  const parts = storedConsultPaidParts(input.booking);
  const originalPaidCents = parts.cardPaidCents + parts.creditPaidCents;
  const refundId = (settled?.cardRefundId || "").trim() || keys[0] || "";
  try {
    await (deps?.restoreOffset ?? restoreAppliedOffsetForRefund)({
      bookingId: input.bookingId,
      refundId,
      refundCents: refundCentsOf(settled!),
      originalPaidCents,
    });
  } catch (err) {
    log.error("Could not restore a payment-correction offset after refund", {
      bookingId: input.bookingId,
      refundId,
      err,
    });
  }

  log.info("Consult refund recorded", {
    bookingId: input.bookingId,
    stripeRefundId: settled?.cardRefundId ?? null,
    customerRefundCode,
  });

  return { alreadyRecorded: false, patch, customerRefundCode };
}
