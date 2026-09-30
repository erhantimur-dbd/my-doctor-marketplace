/**
 * Decide who may join a consult, then mint a short-lived Daily token.
 * Authorisation runs before any Daily call.
 */

import { consultMeetingBounds } from "@/lib/video/meeting-window";
import {
  dailyMeetingJoinUrl,
  mintDailyMeetingToken,
} from "@/lib/video/daily-token";
import { verifyGuestConsultJoin } from "@/lib/video/guest-join-link";
import {
  sourceAllowsGuestSignature,
  type ConsultJoinSource,
} from "@/lib/video/join-source";

export const JOIN_MESSAGES = {
  notVideo: "This appointment is not a video consultation.",
  noRoom: "The video room is not ready yet. Please try again shortly.",
  cancelled: "This appointment was cancelled, so the video room is closed.",
  refunded: "This appointment was refunded, so the video room is closed.",
  notJoinable: "This appointment is not open for video.",
  tooEarly: "You can join 10 minutes before the appointment starts.",
  tooLate: "This video appointment has ended.",
  wrongUser: "You are not allowed to join this appointment.",
  unauthorised: "Sign in, or open the join link from your booking email.",
  invalidTimes: "This appointment time is not valid, so the video room cannot be opened.",
  roomFailed: "The video room could not be opened. Please try again.",
} as const;

const CANCELLED_STATUSES = new Set(["cancelled_patient", "cancelled_doctor"]);
const JOINABLE_STATUSES = new Set(["confirmed", "approved"]);

export interface ConsultJoinBooking {
  id: string;
  bookingNumber: string;
  status: string;
  consultationType: string;
  patientId: string;
  /** doctors.id assigned to this booking. */
  doctorId: string;
  /** profiles.id of that doctor. Clinic org membership does not replace this. */
  doctorProfileId: string | null;
  roomName: string | null;
  roomUrl: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  patientName: string;
  doctorName: string;
}

export interface ConsultJoinCaller {
  userId: string | null;
  /** doctors.id for the signed-in user, when they have a doctor row. */
  doctorId: string | null;
  guestSignature: string | null;
}

export type ConsultJoinRole = "patient" | "doctor";

export type ConsultJoinDecision =
  | { ok: true; role: ConsultJoinRole; userId: string; userName: string; nbf: number; exp: number }
  | { ok: false; error: string };

function displayName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

/**
 * The assigned doctor is bookings.doctor_id (and that doctor's profile).
 * An active clinic organization member who is not that doctor does not
 * get a token. There is no separate assignee column on bookings.
 */
export function callerIsAssignedDoctor(
  booking: ConsultJoinBooking,
  caller: ConsultJoinCaller
): boolean {
  if (caller.doctorId && caller.doctorId === booking.doctorId) return true;
  if (
    caller.userId &&
    booking.doctorProfileId &&
    caller.userId === booking.doctorProfileId
  ) {
    return true;
  }
  return false;
}

function roleForCaller(
  source: ConsultJoinSource,
  booking: ConsultJoinBooking,
  caller: ConsultJoinCaller
): ConsultJoinRole | null {
  const isDoctor = callerIsAssignedDoctor(booking, caller);
  const isPatient = Boolean(caller.userId && caller.userId === booking.patientId);
  const guestOk =
    sourceAllowsGuestSignature(source) &&
    verifyGuestConsultJoin(booking.id, booking.bookingNumber, caller.guestSignature);

  if (source === "doctor_dashboard") return isDoctor ? "doctor" : null;
  if (source === "patient_dashboard") return isPatient ? "patient" : null;
  if (isDoctor) return "doctor";
  if (isPatient) return "patient";
  if (guestOk) return "patient";
  return null;
}

export function assessConsultJoin(input: {
  source: ConsultJoinSource;
  booking: ConsultJoinBooking;
  caller: ConsultJoinCaller;
  now?: Date;
}): ConsultJoinDecision {
  const { booking, caller, source } = input;
  const now = input.now ?? new Date();

  if (booking.consultationType !== "video") {
    return { ok: false, error: JOIN_MESSAGES.notVideo };
  }
  if (CANCELLED_STATUSES.has(booking.status)) {
    return { ok: false, error: JOIN_MESSAGES.cancelled };
  }
  if (booking.status === "refunded") {
    return { ok: false, error: JOIN_MESSAGES.refunded };
  }
  if (!JOINABLE_STATUSES.has(booking.status)) {
    return { ok: false, error: JOIN_MESSAGES.notJoinable };
  }
  if (!booking.roomName || !booking.roomUrl) {
    return { ok: false, error: JOIN_MESSAGES.noRoom };
  }

  const bounds = consultMeetingBounds({
    appointmentDate: booking.appointmentDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
  });
  if (!bounds || bounds.exp <= bounds.nbf) {
    return { ok: false, error: JOIN_MESSAGES.invalidTimes };
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  if (nowSec < bounds.nbf) {
    return { ok: false, error: JOIN_MESSAGES.tooEarly };
  }
  if (nowSec >= bounds.exp) {
    return { ok: false, error: JOIN_MESSAGES.tooLate };
  }

  const role = roleForCaller(source, booking, caller);
  if (!role) {
    return { ok: false, error: JOIN_MESSAGES.wrongUser };
  }

  if (role === "doctor") {
    const userId = booking.doctorProfileId || caller.userId;
    if (!userId) return { ok: false, error: JOIN_MESSAGES.wrongUser };
    return {
      ok: true,
      role,
      userId,
      userName: displayName(booking.doctorName, "Doctor"),
      nbf: bounds.nbf,
      exp: bounds.exp,
    };
  }

  return {
    ok: true,
    role,
    userId: booking.patientId,
    userName: displayName(booking.patientName, "Patient"),
    nbf: bounds.nbf,
    exp: bounds.exp,
  };
}

export async function issueConsultJoin(input: {
  source: ConsultJoinSource;
  booking: ConsultJoinBooking;
  caller: ConsultJoinCaller;
  now?: Date;
}): Promise<{ ok: true; joinUrl: string; role: ConsultJoinRole } | { ok: false; error: string }> {
  const decision = assessConsultJoin(input);
  if (!decision.ok) return decision;

  try {
    const token = await mintDailyMeetingToken({
      roomName: input.booking.roomName as string,
      userName: decision.userName,
      userId: decision.userId,
      isOwner: decision.role === "doctor",
      nbf: decision.nbf,
      exp: decision.exp,
    });
    return {
      ok: true,
      role: decision.role,
      joinUrl: dailyMeetingJoinUrl(input.booking.roomUrl as string, token),
    };
  } catch {
    return { ok: false, error: JOIN_MESSAGES.roomFailed };
  }
}
