import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/calendar/feed/[token]
 * Public ICS subscription feed for a doctor's upcoming bookings.
 * The token is private and unique per doctor — no auth required.
 * Works with any calendar app: Apple Calendar, Outlook, Google Calendar, Thunderbird, etc.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return new NextResponse("Invalid token", { status: 403 });
  }

  const supabase = createAdminClient();

  // Look up doctor by ICS feed token
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("ics_feed_token", token)
    .single();

  if (!doctor) {
    return new NextResponse("Not found", { status: 404 });
  }

  const doctorProfile: any = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;
  const doctorName = `Dr. ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();

  // Fetch upcoming confirmed/completed bookings
  const today = new Date().toISOString().split("T")[0];
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      status,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name)
    `
    )
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "completed"])
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .limit(200);

  // Build ICS
  const events = (bookings || []).map((b) => {
    const patient: any = Array.isArray(b.patient) ? b.patient[0] : b.patient;
    const patientName = `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim();
    const type = b.consultation_type === "video" ? "Video" : "In-Person";

    const start = formatICSDate(new Date(b.start_time));
    const end = formatICSDate(new Date(b.end_time));

    return [
      "BEGIN:VEVENT",
      `UID:${b.id}@mydoctors360.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeICS(`${type} — ${patientName}`)}`,
      `DESCRIPTION:${escapeICS(`Booking #${b.booking_number}\\nPatient: ${patientName}\\nType: ${type}\\nStatus: ${b.status}`)}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//MyDoctors360//Calendar Feed//EN`,
    `X-WR-CALNAME:${escapeICS(`${doctorName} — MyDoctors360`)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:UTC`,
    // Refresh every 30 minutes
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="mydoctors360-calendar.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatICSDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
