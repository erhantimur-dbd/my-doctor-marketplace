import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { bookingReminderEmail } from "@/lib/email/templates";

// Default reminders used when a doctor hasn't configured their own
const DEFAULT_REMINDERS = [
  { minutes_before: 1440, channel: "email", is_enabled: true },
  { minutes_before: 60, channel: "email", is_enabled: true },
  { minutes_before: 60, channel: "in_app", is_enabled: true },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Fetch all upcoming confirmed/approved bookings within next 49 hours
  // (covers 48h reminders + 1h buffer for cron timing)
  const maxLookahead = new Date(now.getTime() + 49 * 60 * 60 * 1000);
  const todayDate = now.toISOString().split("T")[0];
  const maxDate = maxLookahead.toISOString().split("T")[0];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_number,
      patient_id,
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      video_room_url,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, email),
      doctor:doctors!inner(
        id,
        clinic_name,
        address,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `)
    .in("status", ["confirmed", "approved"])
    .gte("appointment_date", todayDate)
    .lte("appointment_date", maxDate);

  if (bookingsError || !bookings || bookings.length === 0) {
    return NextResponse.json({
      message: bookingsError ? "Query error" : "No upcoming bookings",
      error: bookingsError?.message,
      sent: 0,
    });
  }

  // Fetch all doctor reminder preferences in one query
  const doctorIds = [...new Set(bookings.map((b) => b.doctor_id))];
  const { data: allPrefs } = await supabase
    .from("doctor_reminder_preferences")
    .select("doctor_id, minutes_before, channel, is_enabled")
    .in("doctor_id", doctorIds);

  // Group preferences by doctor
  const prefsByDoctor: Record<string, typeof DEFAULT_REMINDERS> = {};
  if (allPrefs) {
    for (const pref of allPrefs) {
      if (!prefsByDoctor[pref.doctor_id]) {
        prefsByDoctor[pref.doctor_id] = [];
      }
      prefsByDoctor[pref.doctor_id].push(pref);
    }
  }

  // Fetch all already-sent reminders for these bookings
  const bookingIds = bookings.map((b) => b.id);
  const { data: sentReminders } = await supabase
    .from("booking_reminders_sent")
    .select("booking_id, minutes_before, channel")
    .in("booking_id", bookingIds);

  const sentSet = new Set(
    (sentReminders || []).map(
      (s) => `${s.booking_id}:${s.minutes_before}:${s.channel}`
    )
  );

  let emailsSent = 0;
  let inAppSent = 0;

  for (const booking of bookings) {
    // Calculate minutes until appointment
    const appointmentTime = new Date(
      `${booking.appointment_date}T${booking.start_time}`
    );
    const minutesUntil = (appointmentTime.getTime() - now.getTime()) / 60000;

    // Skip if appointment already passed
    if (minutesUntil < -30) continue;

    // Get doctor's reminder preferences (or defaults)
    const doctorPrefs =
      prefsByDoctor[booking.doctor_id] || DEFAULT_REMINDERS;

    // Resolve nested joins once per booking
    const patient: any = Array.isArray(booking.patient)
      ? booking.patient[0]
      : booking.patient;
    const doctor: any = Array.isArray(booking.doctor)
      ? booking.doctor[0]
      : booking.doctor;
    const doctorProfile: any = doctor?.profile
      ? Array.isArray(doctor.profile)
        ? doctor.profile[0]
        : doctor.profile
      : null;

    for (const pref of doctorPrefs) {
      if (!pref.is_enabled) continue;

      // A reminder with minutes_before=M should fire when minutesUntil <= M
      // and the appointment hasn't passed yet
      if (minutesUntil > pref.minutes_before || minutesUntil < 0) continue;

      // Check if already sent
      const key = `${booking.id}:${pref.minutes_before}:${pref.channel}`;
      if (sentSet.has(key)) continue;

      if (pref.channel === "email" && patient?.email && doctorProfile) {
        const consultationLabel =
          booking.consultation_type === "video"
            ? "Video Consultation"
            : booking.consultation_type === "phone"
              ? "Phone Consultation"
              : "In-Person Consultation";

        const { subject, html } = bookingReminderEmail({
          patientName: patient.first_name || "Patient",
          doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
          date: booking.appointment_date,
          time: booking.start_time,
          consultationType: consultationLabel,
          bookingNumber: booking.booking_number,
          videoRoomUrl: booking.video_room_url,
          minutesBefore: pref.minutes_before,
          clinicName: doctor.clinic_name,
          address: doctor.address,
        });

        await sendEmail({ to: patient.email, subject, html });
        emailsSent++;
      } else if (pref.channel === "in_app") {
        // Create in-app notification
        let timeLabel = "tomorrow";
        if (pref.minutes_before <= 60) timeLabel = `in ${pref.minutes_before} minutes`;
        else if (pref.minutes_before <= 120) timeLabel = "in 2 hours";
        else if (pref.minutes_before < 1440)
          timeLabel = `in ${Math.round(pref.minutes_before / 60)} hours`;

        await supabase.from("notifications").insert({
          user_id: booking.patient_id,
          type: "booking_reminder",
          title: `Appointment ${timeLabel}`,
          message: `Your appointment with Dr. ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""} is ${timeLabel}.${booking.video_room_url ? " Click to join the video call." : ""}`,
          channels: ["in_app"],
          metadata: {
            booking_id: booking.id,
            video_room_url: booking.video_room_url,
          },
        });
        inAppSent++;
      }

      // Record that this reminder was sent
      await supabase.from("booking_reminders_sent").insert({
        booking_id: booking.id,
        minutes_before: pref.minutes_before,
        channel: pref.channel,
      });

      sentSet.add(key);
    }
  }

  return NextResponse.json({
    bookings_checked: bookings.length,
    emails_sent: emailsSent,
    in_app_sent: inAppSent,
  });
}
