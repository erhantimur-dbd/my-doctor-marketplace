/**
 * Notify a doctor when a patient books a confirmed appointment.
 *
 * Policy:
 * - Email: always on for all bookings (required — doctors must be reachable offline)
 * - SMS: all bookings when notification_sms is true (can be turned off by doctor)
 * - In-app: always
 *
 * Same-day / within-the-hour bookings get urgent copy so doctors can prepare.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { doctorNewBookingEmail } from "@/lib/email/templates";
import { sendSms } from "@/lib/sms/client";
import { doctorNewBookingSms } from "@/lib/sms/templates";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/utils/logger";

const URGENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

export interface DoctorBookingNotifyInput {
  bookingId: string;
  doctorId: string;
  patientId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS or HH:MM
  consultationType: string;
  bookingNumber: string;
  totalAmountCents: number;
  currency: string;
  clinicName?: string | null;
  address?: string | null;
}

export function getBookingStartMs(
  appointmentDate: string,
  startTime: string
): number | null {
  if (!appointmentDate || !startTime) return null;
  const timePart = startTime.length === 5 ? `${startTime}:00` : startTime;
  // Interpret as local wall clock in ISO-ish form; Date parses as local in Node when no Z.
  // Booking times are stored as the doctor's slot wall-clock date+time.
  const ms = Date.parse(`${appointmentDate}T${timePart}`);
  return Number.isFinite(ms) ? ms : null;
}

export function getMinutesUntilBooking(
  appointmentDate: string,
  startTime: string,
  nowMs: number = Date.now()
): number | null {
  const startMs = getBookingStartMs(appointmentDate, startTime);
  if (startMs == null) return null;
  return (startMs - nowMs) / 60_000;
}

export function isBookingWithinNextHour(
  appointmentDate: string,
  startTime: string,
  nowMs: number = Date.now()
): boolean {
  const startMs = getBookingStartMs(appointmentDate, startTime);
  if (startMs == null) return false;
  const delta = startMs - nowMs;
  // Already started (slightly past) still counts as urgent for a few minutes
  return delta <= URGENT_WINDOW_MS && delta > -15 * 60 * 1000;
}

function consultationLabel(type: string): string {
  if (type === "video") return "Video Consultation";
  if (type === "phone") return "Phone Consultation";
  return "In-Person Consultation";
}

/**
 * Send in-app + email (+ SMS if urgent & opted-in) for a newly confirmed booking.
 * Non-throwing: logs errors and continues.
 */
export async function notifyDoctorOfNewBooking(
  input: DoctorBookingNotifyInput
): Promise<void> {
  const supabase = createAdminClient();

  const { data: doctorRow, error: doctorError } = await supabase
    .from("doctors")
    .select(
      `
      id,
      profile_id,
      profile:profiles!doctors_profile_id_fkey(
        first_name,
        last_name,
        email,
        phone,
        notification_email,
        notification_sms
      )
    `
    )
    .eq("id", input.doctorId)
    .single();

  if (doctorError || !doctorRow) {
    log.error("[DoctorNotify] Failed to load doctor profile", {
      err: doctorError,
      doctorId: input.doctorId,
    });
    return;
  }

  const profileRaw = doctorRow.profile as
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        notification_email: boolean | null;
        notification_sms: boolean | null;
      }
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        notification_email: boolean | null;
        notification_sms: boolean | null;
      }[]
    | null;

  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  if (!profile || !doctorRow.profile_id) {
    log.error("[DoctorNotify] Missing doctor profile", {
      doctorId: input.doctorId,
    });
    return;
  }

  const patientName = [input.patientFirstName, input.patientLastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "A patient";

  const doctorName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    "Doctor";

  const dateStr = new Date(input.appointmentDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = input.startTime?.slice(0, 5) || input.startTime;
  const isUrgent = isBookingWithinNextHour(
    input.appointmentDate,
    input.startTime
  );
  const minutesUntil = getMinutesUntilBooking(
    input.appointmentDate,
    input.startTime
  );

  // In-app always
  const inAppTitle = isUrgent ? "Urgent: New Booking" : "New Booking";
  const inAppMessage = isUrgent
    ? `${patientName} booked an appointment starting soon (${dateStr} at ${timeStr}).`
    : `${patientName} booked an appointment on ${dateStr} at ${timeStr}.`;

  await createNotification({
    userId: doctorRow.profile_id,
    type: "new_booking",
    title: inAppTitle,
    message: inAppMessage,
    channels: ["in_app"],
    metadata: {
      booking_id: input.bookingId,
      is_urgent: isUrgent,
    },
  }).catch((err) =>
    log.error("[DoctorNotify] In-app notification failed", { err })
  );

  // Email — always required for all appointments
  if (profile.email) {
    const { subject, html } = doctorNewBookingEmail({
      doctorName: profile.first_name || doctorName,
      patientName,
      date: dateStr,
      time: timeStr,
      consultationType: consultationLabel(input.consultationType),
      bookingNumber: input.bookingNumber,
      amount: input.totalAmountCents / 100,
      currency: (input.currency || "GBP").toUpperCase(),
      isUrgent,
      minutesUntil,
      dashboardUrl: `${APP_URL}/en/doctor-dashboard/bookings`,
      clinicName: input.clinicName,
      address: input.address,
    });

    await sendEmail({ to: profile.email, subject, html }).catch((err) =>
      log.error("[DoctorNotify] Email failed", { err, to: profile.email })
    );
  }

  // SMS — all bookings when doctor has SMS enabled (default on; can opt out)
  // null/undefined treated as enabled for doctors so new accounts get SMS
  const smsEnabled = profile.notification_sms !== false;
  if (smsEnabled && profile.phone) {
    const shortDate = new Date(input.appointmentDate).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "short" }
    );
    await sendSms({
      to: profile.phone,
      body: doctorNewBookingSms({
        doctorName: profile.first_name || doctorName,
        patientName,
        date: shortDate,
        time: timeStr,
        bookingNumber: input.bookingNumber,
        isUrgent,
        minutesUntil,
      }),
    }).catch((err) =>
      log.error("[DoctorNotify] SMS failed", { err, phone: profile.phone })
    );
  }
}
