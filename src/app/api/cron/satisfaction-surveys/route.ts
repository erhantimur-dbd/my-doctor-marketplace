import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { satisfactionSurveyEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

  // Find completed bookings 24-48h ago without a survey
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error: fetchError } = await supabase
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, patient_id, doctor_id,
       patient:profiles!bookings_patient_id_fkey(first_name, email),
       doctor:doctors!inner(
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("status", "completed")
    .lte("completed_at", twentyFourHoursAgo)
    .gte("completed_at", fortyEightHoursAgo);

  if (fetchError) {
    log.error("Survey cron fetch error", { err: fetchError });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ surveyed: 0, message: "No eligible bookings" });
  }

  // Filter out bookings that already have a survey
  const bookingIds = bookings.map((b: any) => b.id);
  const { data: existingSurveys } = await supabase
    .from("satisfaction_surveys")
    .select("booking_id")
    .in("booking_id", bookingIds);

  const existingSet = new Set((existingSurveys || []).map((s: any) => s.booking_id));
  const eligibleBookings = bookings.filter((b: any) => !existingSet.has(b.id));

  let surveyed = 0;
  const errors: string[] = [];

  for (const booking of eligibleBookings) {
    try {
      const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
      const doctor: any = booking.doctor;
      const doctorProfile: any = doctor?.profile
        ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
        : null;

      if (!patient?.email || !doctorProfile) continue;

      const token = crypto.randomUUID();
      const doctorName = `${doctorProfile.first_name} ${doctorProfile.last_name}`;

      // Insert survey row
      const { error: insertError } = await supabase
        .from("satisfaction_surveys")
        .insert({
          booking_id: booking.id,
          patient_id: booking.patient_id,
          doctor_id: booking.doctor_id,
          token,
        });

      if (insertError) {
        log.error("Survey insert error", { err: insertError, bookingId: booking.id });
        errors.push(`Insert failed for ${booking.id}`);
        continue;
      }

      // Send email
      const surveyUrl = `${origin}/en/survey/${token}`;
      const { subject, html } = satisfactionSurveyEmail({
        patientName: patient.first_name || "there",
        doctorName,
        date: new Date(booking.appointment_date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        surveyUrl,
      });

      await sendEmail({ to: patient.email, subject, html });
      surveyed++;
    } catch (err) {
      log.error("Survey cron processing error", { err, bookingId: booking.id });
      errors.push(`Error for ${booking.id}`);
    }
  }

  return NextResponse.json({
    surveyed,
    eligible: eligibleBookings.length,
    errors: errors.length,
  });
}
