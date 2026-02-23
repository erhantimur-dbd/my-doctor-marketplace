"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cancelBooking(
  bookingId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to cancel a booking." };
  }

  // Verify booking belongs to user and is cancellable
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, patient_id")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Booking not found." };
  }

  if (booking.patient_id !== user.id) {
    return { error: "You are not authorized to cancel this booking." };
  }

  if (booking.status !== "confirmed" && booking.status !== "approved") {
    return { error: "This booking cannot be cancelled." };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_patient",
      cancellation_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    return { error: "Failed to cancel booking. Please try again." };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${bookingId}`);

  return {};
}
