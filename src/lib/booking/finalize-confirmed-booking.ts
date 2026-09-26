/**
 * Side effects that paid Checkout runs inside checkout.session.completed,
 * shared with charge-skip / wallet-only confirms that never hit Stripe.
 *
 * - Video: create (or reuse) the Daily room and persist video_room_url +
 *   daily_room_name.
 * - Doctor: in-app new_booking row plus the same email/SMS path as the webhook
 *   (notifyDoctorOfNewBooking). Skips when that notification already exists.
 *
 * Non-throwing. A room or notify failure must not roll back a confirmed booking.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRoom, getRoom } from "@/lib/daily/client";
import { notifyDoctorOfNewBooking } from "@/lib/notifications/doctor-new-booking";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { log } from "@/lib/utils/logger";

export interface ConfirmedBookingFinalizeInput {
  id: string;
  bookingNumber: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  consultationType: string;
  totalAmountCents: number;
  currency: string;
  videoRoomUrl?: string | null;
  dailyRoomName?: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  clinicName?: string | null;
  address?: string | null;
  /**
   * Webhook skips doctor notify when the patient or doctor profile join is
   * missing. Charge-skip defaults this to true once those joins load.
   */
  notifyDoctor?: boolean;
}

export interface FinalizeConfirmedBookingResult {
  found: boolean;
  videoRoomUrl: string | null;
  notifiedDoctor: boolean;
  consultationType: string | null;
}

interface BookingFinalizeRow {
  id: string;
  booking_number: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  consultation_type: string;
  total_amount_cents: number;
  currency: string;
  video_room_url: string | null;
  daily_room_name: string | null;
  patient:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
  doctor:
    | {
        clinic_name: string | null;
        address: string | null;
        profile:
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null;
      }
    | {
        clinic_name: string | null;
        address: string | null;
        profile:
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null;
      }[]
    | null;
}

const BOOKING_FINALIZE_SELECT = `
  id,
  booking_number,
  patient_id,
  doctor_id,
  appointment_date,
  start_time,
  end_time,
  consultation_type,
  total_amount_cents,
  currency,
  video_room_url,
  daily_room_name,
  patient:profiles!bookings_patient_id_fkey(first_name, last_name),
  doctor:doctors!inner(
    clinic_name,
    address,
    profile:profiles!doctors_profile_id_fkey(first_name, last_name)
  )
`;

export function dailyRoomNameForBooking(bookingNumber: string): string {
  return `md-${bookingNumber.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

const TIME_ONLY_END = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

/**
 * Appointment end as an absolute instant.
 * bookings.end_time is timestamptz, so Supabase may return a full timestamp
 * (ISO `2026-09-26T09:30:00.000Z` or Postgres `2026-09-26 09:30:00+00`).
 * Time-only values (`HH:mm` / `HH:mm:ss`) are combined with appointmentDate.
 */
function appointmentEndDate(appointmentDate: string, endTime: string): Date {
  const value = endTime.trim();
  const timeOnly = TIME_ONLY_END.exec(value);
  if (timeOnly) {
    const hours = timeOnly[1].padStart(2, "0");
    const minutes = timeOnly[2];
    const seconds = timeOnly[3] ?? "00";
    return new Date(`${appointmentDate}T${hours}:${minutes}:${seconds}`);
  }

  let timestamp = value;
  if (/^\d{4}-\d{2}-\d{2} /.test(timestamp)) {
    timestamp = `${timestamp.slice(0, 10)}T${timestamp.slice(11)}`;
  }
  // `+00` is rejected once a `T` separator is present; `+0000` needs a colon.
  timestamp = timestamp.replace(/([+-]\d{2})$/, "$1:00");
  timestamp = timestamp.replace(/([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  return new Date(timestamp);
}

/** Room expires one hour after the appointment end, matching Checkout. */
export function dailyRoomExpiresAtUnix(
  appointmentDate: string,
  endTime: string
): number {
  const endMs = appointmentEndDate(appointmentDate, endTime).getTime();
  if (!Number.isFinite(endMs)) {
    throw new Error(
      `Invalid Daily room expiry (appointmentDate=${appointmentDate}, endTime=${endTime})`
    );
  }
  return Math.floor(endMs / 1000) + 3600;
}

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyResult(): FinalizeConfirmedBookingResult {
  return {
    found: false,
    videoRoomUrl: null,
    notifiedDoctor: false,
    consultationType: null,
  };
}

/**
 * Persist a Daily room for a video booking. Returns the room URL, or null
 * when the consultation is not video. Reuses an existing pair of columns.
 * If Daily says the room name already exists, loads that room and persists it.
 */
export async function ensureDailyVideoRoom(
  booking: {
    id: string;
    bookingNumber: string;
    appointmentDate: string;
    endTime: string;
    consultationType: string;
    videoRoomUrl?: string | null;
    dailyRoomName?: string | null;
  },
  supabase: SupabaseClient
): Promise<string | null> {
  if (booking.consultationType !== "video") return null;
  if (booking.videoRoomUrl && booking.dailyRoomName) return booking.videoRoomUrl;

  const roomName = dailyRoomNameForBooking(booking.bookingNumber);
  const expiresAt = dailyRoomExpiresAtUnix(
    booking.appointmentDate,
    booking.endTime
  );

  let room;
  try {
    room = await createRoom({
      name: roomName,
      expiresAt,
      maxParticipants: 2,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(message)) throw err;
    room = await getRoom(roomName);
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      video_room_url: room.url,
      daily_room_name: room.name,
    })
    .eq("id", booking.id);

  if (error) {
    log.error("[FinalizeBooking] Failed to persist Daily room", {
      err: error,
      bookingId: booking.id,
    });
  }

  return room.url;
}

async function doctorAlreadyNotified(
  supabase: SupabaseClient,
  bookingId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("type", "new_booking")
    .contains("data", { booking_id: bookingId })
    .limit(1)
    .maybeSingle();

  if (error) {
    log.error("[FinalizeBooking] notification lookup failed", {
      err: error,
      bookingId,
    });
    return false;
  }

  return Boolean(data);
}

export async function finalizeConfirmedBooking(
  input: ConfirmedBookingFinalizeInput,
  options?: { supabase?: SupabaseClient }
): Promise<FinalizeConfirmedBookingResult> {
  const supabase = options?.supabase ?? createAdminClient();
  let videoRoomUrl: string | null = input.videoRoomUrl ?? null;

  try {
    const ensured = await ensureDailyVideoRoom(
      {
        id: input.id,
        bookingNumber: input.bookingNumber,
        appointmentDate: input.appointmentDate,
        endTime: input.endTime,
        consultationType: input.consultationType,
        videoRoomUrl: input.videoRoomUrl,
        dailyRoomName: input.dailyRoomName,
      },
      supabase
    );
    if (ensured) videoRoomUrl = ensured;
  } catch (err) {
    log.error("[FinalizeBooking] Daily.co room creation error", {
      err,
      bookingId: input.id,
    });
  }

  let notifiedDoctor = false;
  if (input.notifyDoctor !== false) {
    try {
      const already = await doctorAlreadyNotified(supabase, input.id);
      if (!already) {
        await notifyDoctorOfNewBooking({
          bookingId: input.id,
          doctorId: input.doctorId,
          patientId: input.patientId,
          patientFirstName: input.patientFirstName,
          patientLastName: input.patientLastName,
          appointmentDate: input.appointmentDate,
          startTime: input.startTime,
          consultationType: input.consultationType,
          bookingNumber: input.bookingNumber,
          totalAmountCents: input.totalAmountCents,
          currency: input.currency,
          clinicName: input.clinicName,
          address: input.address,
        });
        notifiedDoctor = true;
      }
    } catch (err) {
      log.error("[FinalizeBooking] Doctor notify failed", {
        err,
        bookingId: input.id,
      });
    }
  }

  return {
    found: true,
    videoRoomUrl,
    notifiedDoctor,
    consultationType: input.consultationType,
  };
}

export async function finalizeConfirmedBookingById(
  bookingId: string,
  options?: { supabase?: SupabaseClient }
): Promise<FinalizeConfirmedBookingResult> {
  try {
    const supabase = options?.supabase ?? createAdminClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_FINALIZE_SELECT)
      .eq("id", bookingId)
      .single();

    if (error || !data) {
      log.error("[FinalizeBooking] Booking not found", { err: error, bookingId });
      return emptyResult();
    }

    const row = data as BookingFinalizeRow;
    const patient = unwrapJoin(row.patient);
    const doctor = unwrapJoin(row.doctor);
    const doctorProfile = unwrapJoin(doctor?.profile);

    return finalizeConfirmedBooking(
      {
        id: row.id,
        bookingNumber: row.booking_number,
        patientId: row.patient_id,
        doctorId: row.doctor_id,
        appointmentDate: row.appointment_date,
        startTime: row.start_time,
        endTime: row.end_time,
        consultationType: row.consultation_type,
        totalAmountCents: row.total_amount_cents,
        currency: row.currency,
        videoRoomUrl: row.video_room_url,
        dailyRoomName: row.daily_room_name,
        patientFirstName: patient?.first_name ?? null,
        patientLastName: patient?.last_name ?? null,
        clinicName: doctor?.clinic_name ?? null,
        address: doctor?.address ?? null,
        notifyDoctor: Boolean(patient && doctorProfile),
      },
      { supabase }
    );
  } catch (err) {
    log.error("[FinalizeBooking] Unexpected error", { err, bookingId });
    return emptyResult();
  }
}

/**
 * Softsmoke Connect charge-skip (and any caller that confirms without Checkout).
 * Marks the pending booking confirmed, then runs the shared finalize path.
 */
export async function confirmBookingWithoutStripeCheckout(
  bookingId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: BOOKING_STATUSES.CONFIRMED })
    .eq("id", bookingId);

  if (error) {
    log.error("Softsmoke connect bypass confirm failed", { err: error });
    return { error: "Failed to create booking. Please try again." };
  }

  await finalizeConfirmedBookingById(bookingId, { supabase });
  return {};
}
