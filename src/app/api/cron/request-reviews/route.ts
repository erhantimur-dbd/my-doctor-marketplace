import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { reviewRequestEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

/**
 * Wave B5 — automated review requests after completed appointments.
 * Window: completed 24–72h ago, no existing review, no prior review_request row.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error: fetchError } = await supabase
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, patient_id, doctor_id, completed_at,
       patient:profiles!bookings_patient_id_fkey(first_name, email),
       doctor:doctors!inner(
         slug,
         title,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("status", "completed")
    .lte("completed_at", twentyFourHoursAgo)
    .gte("completed_at", seventyTwoHoursAgo);

  if (fetchError) {
    log.error("Review request cron fetch error", { err: fetchError });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ requested: 0, message: "No eligible bookings" });
  }

  const bookingIds = bookings.map((b: { id: string }) => b.id);

  const [{ data: existingReviews }, { data: existingRequests }] = await Promise.all([
    supabase.from("reviews").select("booking_id").in("booking_id", bookingIds),
    supabase.from("review_requests").select("booking_id").in("booking_id", bookingIds),
  ]);

  const reviewed = new Set((existingReviews || []).map((r: { booking_id: string }) => r.booking_id));
  const requested = new Set(
    (existingRequests || []).map((r: { booking_id: string }) => r.booking_id)
  );

  const eligible = bookings.filter(
    (b: { id: string }) => !reviewed.has(b.id) && !requested.has(b.id)
  );

  let sent = 0;
  const errors: string[] = [];

  for (const booking of eligible) {
    try {
      const patient: any = Array.isArray(booking.patient)
        ? booking.patient[0]
        : booking.patient;
      const doctor: any = booking.doctor;
      const doctorProfile: any = doctor?.profile
        ? Array.isArray(doctor.profile)
          ? doctor.profile[0]
          : doctor.profile
        : null;

      if (!patient?.email || !doctorProfile) continue;

      const token = crypto.randomUUID();
      const doctorName = `${doctor.title || "Dr."} ${doctorProfile.first_name} ${doctorProfile.last_name}`.trim();

      const { error: insertError } = await supabase.from("review_requests").insert({
        booking_id: booking.id,
        patient_id: booking.patient_id,
        doctor_id: booking.doctor_id,
        token,
      });

      if (insertError) {
        log.error("Review request insert error", {
          err: insertError,
          bookingId: booking.id,
        });
        errors.push(`Insert failed for ${booking.id}`);
        continue;
      }

      const reviewUrl = `${origin}/en/dashboard/reviews?booking=${booking.id}`;
      const { subject, html } = reviewRequestEmail({
        patientName: patient.first_name || "there",
        doctorName,
        date: new Date(booking.appointment_date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        reviewUrl,
      });

      await sendEmail({ to: patient.email, subject, html });
      sent++;
    } catch (err) {
      log.error("Review request cron processing error", {
        err,
        bookingId: booking.id,
      });
      errors.push(`Error for ${booking.id}`);
    }
  }

  return NextResponse.json({
    requested: sent,
    eligible: eligible.length,
    errors: errors.length,
  });
}
