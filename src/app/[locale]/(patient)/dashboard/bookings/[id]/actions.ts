"use server";

import { cancelBooking as cancelBookingWithRefund } from "@/actions/booking";

/**
 * Patient dashboard cancel. Refund destination defaults to bank: card money
 * goes back to the card, and any MyDoctors360 credit goes back to the wallet.
 */
export async function cancelBooking(
  bookingId: string,
  reason: string
): Promise<{ error?: string; message?: string }> {
  const result = await cancelBookingWithRefund({
    booking_id: bookingId,
    reason: reason || undefined,
    refund_destination: "bank",
  });

  if (result.error) return { error: result.error };
  return {
    message:
      "message" in result && result.message
        ? result.message
        : "Booking cancelled successfully.",
  };
}
