/**
 * Voice AI must never auto-complete a booking. Any booking-related action
 * requires an explicit user confirmation step.
 */

export type VoiceBookingIntent =
  | { kind: "none" }
  | { kind: "navigate_book"; path: string }
  | { kind: "confirm_booking"; bookingPayloadId: string };

/**
 * Returns whether a voice-derived intent may execute without a UI confirm gate.
 * Only non-mutating / non-booking intents pass; booking always requires confirm.
 */
export function canAutoExecuteVoiceIntent(intent: VoiceBookingIntent): boolean {
  if (intent.kind === "none") return true;
  // Navigation to book UI is allowed (user still completes wizard + payment).
  // Actually booking / confirming a booking never auto-executes.
  if (intent.kind === "navigate_book") return true;
  if (intent.kind === "confirm_booking") return false;
  return false;
}

/**
 * Gate a booking confirmation: requires `userConfirmed === true`.
 * Returns the payload id only when confirmed; otherwise null.
 */
export function resolveVoiceBookingConfirmation(
  intent: VoiceBookingIntent,
  userConfirmed: boolean
): string | null {
  if (intent.kind !== "confirm_booking") return null;
  if (!userConfirmed) return null;
  return intent.bookingPayloadId;
}
