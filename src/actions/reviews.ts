"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Fetch a single highlighted 5-star review (most recent with a comment) */
export async function getFeaturedReview(doctorId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select(
      `comment, rating, created_at,
       patient:profiles!reviews_patient_id_fkey(first_name, last_name)`
    )
    .eq("doctor_id", doctorId)
    .eq("is_visible", true)
    .eq("rating", 5)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const patient: any = Array.isArray(data.patient)
    ? data.patient[0]
    : data.patient;

  return {
    comment: data.comment as string,
    firstName: patient?.first_name ?? "Patient",
    lastInitial: patient?.last_name?.[0] ?? "",
  };
}

export async function submitReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const bookingId = formData.get("booking_id") as string;
  const rating = parseInt(formData.get("rating") as string, 10);
  const title = formData.get("title") as string;
  const comment = formData.get("comment") as string;

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return { error: "Invalid review data" };
  }

  // Verify booking belongs to user and is completed
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, doctor_id, status")
    .eq("id", bookingId)
    .eq("patient_id", user.id)
    .single();

  if (!booking) return { error: "Booking not found" };
  if (booking.status !== "completed") {
    return { error: "Can only review completed appointments" };
  }

  // Check if already reviewed
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .single();

  if (existing) return { error: "Already reviewed this appointment" };

  const { error } = await supabase.from("reviews").insert({
    booking_id: bookingId,
    patient_id: user.id,
    doctor_id: booking.doctor_id,
    rating,
    title: title || null,
    comment: comment || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/reviews");
  revalidatePath("/doctor-dashboard/reviews");
  return { success: true };
}

export async function respondToReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const reviewId = formData.get("review_id") as string;
  const response = formData.get("response") as string;

  if (!reviewId || !response) return { error: "Invalid data" };

  // Verify doctor owns this review
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor" };

  const { data: review } = await supabase
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("doctor_id", doctor.id)
    .single();

  if (!review) return { error: "Review not found" };

  const { error } = await supabase
    .from("reviews")
    .update({
      doctor_response: response,
      doctor_responded_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/reviews");
  return { success: true };
}

export async function toggleFavorite(doctorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Check if already favorited (composite PK: patient_id + doctor_id)
  const { data: existing } = await supabase
    .from("favorites")
    .select("patient_id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("patient_id", user.id)
      .eq("doctor_id", doctorId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/favorites");
    return { favorited: false };
  } else {
    const { error } = await supabase.from("favorites").insert({
      patient_id: user.id,
      doctor_id: doctorId,
    });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/favorites");
    return { favorited: true };
  }
}

/** Check if the current user has favorited a specific doctor */
export async function checkIsFavorited(doctorId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("favorites")
    .select("patient_id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  return !!data;
}
