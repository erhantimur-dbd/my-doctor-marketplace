"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface SubmitReviewInput {
  bookingId: string;
  doctorId: string;
  rating: number;
  title: string | null;
  comment: string | null;
}

export async function submitReview(
  input: SubmitReviewInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to submit a review." };
  }

  // Validate rating
  if (input.rating < 1 || input.rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  // Verify booking belongs to user and is completed
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, patient_id, status, doctor_id")
    .eq("id", input.bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Booking not found." };
  }

  if (booking.patient_id !== user.id) {
    return { error: "You are not authorized to review this booking." };
  }

  if (booking.status !== "completed") {
    return { error: "You can only review completed bookings." };
  }

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", input.bookingId)
    .eq("patient_id", user.id)
    .single();

  if (existingReview) {
    return { error: "You have already reviewed this booking." };
  }

  // Insert review
  const { error: insertError } = await supabase.from("reviews").insert({
    booking_id: input.bookingId,
    doctor_id: input.doctorId,
    patient_id: user.id,
    rating: input.rating,
    title: input.title,
    comment: input.comment,
    is_visible: true,
  });

  if (insertError) {
    return { error: "Failed to submit review. Please try again." };
  }

  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard/bookings");

  return {};
}
