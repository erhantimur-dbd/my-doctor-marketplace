"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod/v4";
import { randomUUID } from "crypto";

const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createRecurringBookingSchema = z.object({
  doctor_id: z.string().regex(uuidFormat, "Invalid doctor ID format"),
  consultation_type: z.enum(["in_person", "video"]),
  start_date: z.string(), // "YYYY-MM-DD"
  start_time: z.string(), // "HH:MM:SS"
  end_time: z.string(),   // "HH:MM:SS"
  recurrence_pattern: z.enum(["weekly", "biweekly"]),
  num_weeks: z.number().int().min(2).max(12),
  patient_notes: z.string().max(1000).nullish(),
  service_id: z.string().regex(uuidFormat).nullish(),
  duration_minutes: z.number().int().min(15).max(60).nullish(),
});

export type CreateRecurringBookingInput = z.infer<typeof createRecurringBookingSchema>;

/**
 * Validate all recurring slots are available before creating bookings.
 * Returns the list of dates or an error.
 */
export async function validateRecurringSlots(input: CreateRecurringBookingInput) {
  const parsed = createRecurringBookingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input", dates: [] as string[] };

  const { start_date, recurrence_pattern, num_weeks, doctor_id, start_time, consultation_type } = parsed.data;

  const interval = recurrence_pattern === "weekly" ? 7 : 14;
  const dates: string[] = [];
  const startDate = new Date(start_date + "T00:00:00");

  for (let i = 0; i < num_weeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * interval);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Check availability for each date
  const adminDb = createAdminClient();
  const unavailableDates: string[] = [];

  for (const date of dates) {
    const { data: slots } = await adminDb.rpc("get_available_slots", {
      p_doctor_id: doctor_id,
      p_date: date,
      p_consultation_type: consultation_type,
    });

    const slotAvailable = slots?.some(
      (s: { slot_start: string; is_available: boolean }) =>
        s.slot_start === start_time && s.is_available
    );

    if (!slotAvailable) {
      unavailableDates.push(date);
    }
  }

  if (unavailableDates.length > 0) {
    return {
      error: `The following dates are unavailable: ${unavailableDates.join(", ")}`,
      unavailableDates,
      dates,
    };
  }

  return { dates, unavailableDates: [] };
}

/**
 * Create a series of recurring bookings.
 * All bookings share the same recurring_group_id.
 * Returns the group ID and first booking ID for checkout.
 */
export async function createRecurringBookings(input: CreateRecurringBookingInput) {
  const parsed = createRecurringBookingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const {
    doctor_id,
    consultation_type,
    start_date,
    start_time,
    end_time,
    recurrence_pattern,
    num_weeks,
    patient_notes,
    service_id,
  } = parsed.data;

  // Generate dates
  const interval = recurrence_pattern === "weekly" ? 7 : 14;
  const dates: string[] = [];
  const startDate = new Date(start_date + "T00:00:00");

  for (let i = 0; i < num_weeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * interval);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Fetch doctor info
  const adminDb = createAdminClient();
  const { data: doctor } = await adminDb
    .from("doctors")
    .select("*, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("id", doctor_id)
    .single();

  if (!doctor) return { error: "Doctor not found" };

  // Calculate fees
  let consultationFeeCents = consultation_type === "video"
    ? (doctor.video_consultation_fee_cents || doctor.consultation_fee_cents)
    : doctor.consultation_fee_cents;

  let serviceName: string | null = null;

  if (service_id) {
    const { data: service } = await adminDb
      .from("doctor_services")
      .select("price_cents, name")
      .eq("id", service_id)
      .single();
    if (service) {
      consultationFeeCents = service.price_cents;
      serviceName = service.name;
    }
  }

  // Platform fee per booking
  const { getBookingFeeCents } = await import("@/lib/utils/currency");
  const platformFeeCents = getBookingFeeCents(doctor.base_currency);
  const totalAmountCents = consultationFeeCents + platformFeeCents;

  const recurringGroupId = randomUUID();
  const bookingIds: string[] = [];

  // Create all bookings
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    const bookingData = {
      patient_id: user.id,
      doctor_id,
      appointment_date: date,
      start_time: `${date}T${start_time}`,
      end_time: `${date}T${end_time}`,
      consultation_type,
      status: "pending_payment",
      currency: doctor.base_currency,
      consultation_fee_cents: consultationFeeCents,
      platform_fee_cents: platformFeeCents,
      total_amount_cents: totalAmountCents,
      payment_mode: "full",
      patient_notes: i === 0 ? patient_notes : null,
      service_id: service_id || null,
      service_name: serviceName,
      recurring_group_id: recurringGroupId,
      recurrence_pattern,
      recurrence_index: i,
    };

    const { data: booking, error } = await adminDb
      .from("bookings")
      .insert(bookingData)
      .select("id")
      .single();

    if (error) {
      // Rollback: cancel all previously created bookings in this group
      await adminDb
        .from("bookings")
        .delete()
        .eq("recurring_group_id", recurringGroupId)
        .eq("status", "pending_payment");
      return { error: `Failed to create booking for ${date}: ${error.message}` };
    }

    bookingIds.push(booking.id);
  }

  return {
    recurringGroupId,
    bookingIds,
    totalBookings: dates.length,
    totalAmountCents: totalAmountCents * dates.length,
    dates,
  };
}

/**
 * Cancel all bookings in a recurring series.
 */
export async function cancelRecurringSeries(recurringGroupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminDb = createAdminClient();

  // Verify ownership
  const { data: bookings } = await adminDb
    .from("bookings")
    .select("id, status, patient_id")
    .eq("recurring_group_id", recurringGroupId);

  if (!bookings || bookings.length === 0) return { error: "No recurring bookings found" };
  if (bookings[0].patient_id !== user.id) return { error: "Unauthorized" };

  // Cancel future bookings that are still confirmed/approved
  const today = new Date().toISOString().split("T")[0];
  const { error } = await adminDb
    .from("bookings")
    .update({
      status: "cancelled_patient",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Recurring series cancelled",
    })
    .eq("recurring_group_id", recurringGroupId)
    .in("status", ["confirmed", "approved", "pending_payment", "pending_approval"])
    .gte("appointment_date", today);

  if (error) return { error: safeError(error) };

  return { success: true };
}
