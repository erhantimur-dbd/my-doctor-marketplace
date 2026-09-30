import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ConsultJoinBooking, ConsultJoinCaller } from "@/lib/video/consult-join";
import {
  BOOKING_CURRENT_DOCTOR_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
} from "@/lib/patient/booking-doctor-embed";

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function personName(
  profile: { first_name?: string | null; last_name?: string | null } | null,
  fallback: string
): string {
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || fallback;
}

const BOOKING_SELECT = `
  id,
  booking_number,
  status,
  consultation_type,
  patient_id,
  doctor_id,
  appointment_date,
  start_time,
  end_time,
  video_room_url,
  daily_room_name,
  patient:profiles!bookings_patient_id_fkey(first_name, last_name),
  doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(
    id,
    profile_id,
    profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
  )
`;

export async function loadConsultJoinAttempt(input: {
  bookingId: string;
  guestSignature: string | null;
  guestLinkExp: number | null;
}): Promise<{ booking: ConsultJoinBooking; caller: ConsultJoinCaller } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", input.bookingId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    booking_number: string;
    status: string;
    consultation_type: string;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    video_room_url: string | null;
    daily_room_name: string | null;
    patient:
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null;
    doctor:
      | {
          id: string;
          profile_id: string | null;
          profile:
            | { first_name: string | null; last_name: string | null }
            | { first_name: string | null; last_name: string | null }[]
            | null;
        }
      | {
          id: string;
          profile_id: string | null;
          profile:
            | { first_name: string | null; last_name: string | null }
            | { first_name: string | null; last_name: string | null }[]
            | null;
        }[]
      | null;
  };

  const patient = unwrap(row.patient);
  const doctor = unwrap(row.doctor);
  const doctorProfile = unwrap(doctor?.profile);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let callerDoctorId: string | null = null;
  if (user) {
    const { data: doctorRow } = await admin
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    callerDoctorId = (doctorRow as { id: string } | null)?.id ?? null;
  }

  return {
    booking: {
      id: row.id,
      bookingNumber: row.booking_number,
      status: row.status,
      consultationType: row.consultation_type,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      doctorProfileId: doctor?.profile_id ?? null,
      roomName: row.daily_room_name,
      roomUrl: row.video_room_url,
      appointmentDate: row.appointment_date,
      startTime: row.start_time,
      endTime: row.end_time,
      patientName: personName(patient, "Patient"),
      doctorName: personName(doctorProfile, "Doctor"),
    },
    caller: {
      userId: user?.id ?? null,
      doctorId: callerDoctorId,
      guestSignature: input.guestSignature,
      guestLinkExp: input.guestLinkExp,
    },
  };
}
