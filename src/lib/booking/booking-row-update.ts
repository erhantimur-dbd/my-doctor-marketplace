import { log } from "@/lib/utils/logger";
import { safeError } from "@/lib/utils/safe-error";

/**
 * Returned when money already moved and the booking UPDATE did not land.
 * Supabase returns no error when RLS matches zero rows, so callers must
 * check the selected rows and not treat that as success.
 */
export const STRIPE_REFUND_BOOKING_NOT_UPDATED =
  "The Stripe refund succeeded, but the booking record was not updated.";

export function bookingRowUpdateError(input: {
  error: { message?: string } | null;
  rows: readonly { id: string }[] | null;
  stripeRefundSucceeded: boolean;
  bookingId: string;
  stripeRefundId?: string | null;
}): { error: string } | null {
  const rowsUpdated = input.rows?.length ?? 0;
  if (!input.error && rowsUpdated > 0) return null;

  if (input.stripeRefundSucceeded) {
    log.error("Stripe refund succeeded but the booking row was not updated", {
      bookingId: input.bookingId,
      stripeRefundId: input.stripeRefundId ?? null,
      rowsUpdated,
      err: input.error ?? null,
    });
    return { error: STRIPE_REFUND_BOOKING_NOT_UPDATED };
  }

  log.error("Booking update did not change a row", {
    bookingId: input.bookingId,
    rowsUpdated,
    err: input.error ?? null,
  });
  if (input.error) return { error: safeError(input.error) };
  return { error: "Booking was not updated." };
}
