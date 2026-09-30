/**
 * Consult join window shared by meeting tokens and the waiting-room button.
 *
 * Early join matches the waiting room: 10 minutes before the start.
 * The token stays valid until 30 minutes after the consult ends.
 * Room expiry (appointment end + 1 hour) is a separate Daily room setting.
 */

import { resolveBookingInstant } from "@/lib/booking/appointment-instant";

/** How long a meeting token remains valid after the consult ends. */
export const MEETING_TOKEN_GRACE_AFTER_END_SECONDS = 30 * 60;

/** Waiting-room rule: participants may join this long before the start. */
export const EARLY_JOIN_WINDOW_SECONDS = 10 * 60;

export interface ConsultMeetingBounds {
  start: Date;
  end: Date;
  /** Unix seconds. Token is not valid before this. */
  nbf: number;
  /** Unix seconds. Token expires at this instant. */
  exp: number;
}

export function consultMeetingBounds(input: {
  appointmentDate: string;
  startTime: string;
  endTime: string;
}): ConsultMeetingBounds | null {
  const start = resolveBookingInstant(input.appointmentDate, input.startTime);
  const end = resolveBookingInstant(input.appointmentDate, input.endTime);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return {
    start,
    end,
    nbf: Math.floor(startMs / 1000) - EARLY_JOIN_WINDOW_SECONDS,
    exp: Math.floor(endMs / 1000) + MEETING_TOKEN_GRACE_AFTER_END_SECONDS,
  };
}

export function isWithinConsultJoinWindow(input: {
  now: Date;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}): boolean {
  const bounds = consultMeetingBounds(input);
  if (!bounds) return false;
  const nowSec = Math.floor(input.now.getTime() / 1000);
  return nowSec >= bounds.nbf && nowSec < bounds.exp;
}
