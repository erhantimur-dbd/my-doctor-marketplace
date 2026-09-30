import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { evaluateCalendarDownloadAccess } from "@/lib/booking/calendar-download";
import { buildPatientCalendarEvent } from "@/lib/booking/patient-calendar";
import {
  BOOKING_CURRENT_DOCTOR_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
  patientBookingDoctorName,
} from "@/lib/patient/booking-doctor-embed";

const bookingSelect = `
  id,
  booking_number,
  appointment_date,
  start_time,
  end_time,
  consultation_type,
  status,
  created_at,
  updated_at,
  patient_id,
  doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(
    title,
    clinic_name,
    address,
    profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
  )
`;

function cancelled(status: string | null | undefined): boolean {
  return typeof status === "string" && status.startsWith("cancelled");
}

/**
 * GET /api/bookings/:id/calendar.ics
 * Same access as the booking confirmation page.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = request.nextUrl;
  const query = {
    session_id: url.searchParams.get("session_id"),
    booking_id: url.searchParams.get("booking_id"),
    wallet: url.searchParams.get("wallet"),
    confirm: url.searchParams.get("confirm"),
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let stripeBookingId: string | null = null;
  let stripeError = false;
  if (query.session_id?.trim()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        query.session_id.trim()
      );
      stripeBookingId = session.metadata?.booking_id ?? null;
    } catch {
      stripeError = true;
    }
  }

  const access = evaluateCalendarDownloadAccess({
    pathBookingId: id,
    query,
    userId: user?.id ?? null,
    stripeBookingId,
    stripeError,
  });
  if (!access.ok) {
    return new NextResponse(access.status === 401 ? "Unauthorized" : "Not found", {
      status: access.status,
    });
  }

  let { data: booking } = await supabase
    .from("bookings")
    .select(bookingSelect)
    .eq("id", id)
    .maybeSingle();

  if (!booking && access.adminFallback) {
    const admin = createAdminClient();
    const res = await admin
      .from("bookings")
      .select(bookingSelect)
      .eq("id", id)
      .maybeSingle();
    booking = res.data;
  }

  if (!booking) {
    return new NextResponse("Not found", { status: 404 });
  }

  const patientId = (booking as { patient_id?: string | null }).patient_id;
  if (access.requireOwner && patientId && patientId !== user?.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const doctor = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
  const doctorProfile = Array.isArray(doctor?.profile) ? doctor.profile[0] : doctor?.profile;
  const event = buildPatientCalendarEvent({
    bookingId: booking.id,
    doctorName: patientBookingDoctorName({ ...doctor, profile: doctorProfile }),
    consultationType: booking.consultation_type,
    appointmentDate: booking.appointment_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    clinicName: doctor?.clinic_name,
    address: doctor?.address,
    bookingNumber: booking.booking_number,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    method: cancelled(booking.status) ? "CANCEL" : "REQUEST",
  });

  if (!event) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(event.ics, {
    status: 200,
    headers: {
      "Content-Type": event.contentType,
      "Content-Disposition": `attachment; filename="${event.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
