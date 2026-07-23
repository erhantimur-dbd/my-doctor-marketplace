/**
 * Voice AI must never auto-complete a booking. Any booking-related action
 * requires an explicit user confirmation step.
 */

export type VoiceBookingDraft = {
  doctorSlug: string;
  doctorName: string;
  date: string;
  time: string;
  consultationType: "in_person" | "video";
  bookPath: string;
};

export type VoiceBookingIntent =
  | { kind: "none" }
  | { kind: "navigate_book"; path: string }
  | { kind: "confirm_booking"; bookingPayloadId: string }
  | { kind: "propose_booking"; draft: VoiceBookingDraft };

/**
 * Returns whether a voice-derived intent may execute without a UI confirm gate.
 * Only non-mutating / non-booking intents pass; booking always requires confirm.
 */
export function canAutoExecuteVoiceIntent(intent: VoiceBookingIntent): boolean {
  if (intent.kind === "none") return true;
  // Navigation to book UI is allowed (user still completes wizard + payment).
  if (intent.kind === "navigate_book") return true;
  if (intent.kind === "confirm_booking") return false;
  if (intent.kind === "propose_booking") return false;
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

/**
 * After proposeBooking tool + user taps Confirm, return the book path
 * (wizard still handles payment). Never returns a path without confirm.
 */
export function resolveProposedBookingPath(
  draft: VoiceBookingDraft | null | undefined,
  userConfirmed: boolean
): string | null {
  if (!userConfirmed || !draft?.bookPath) return null;
  if (!draft.bookPath.startsWith("/doctors/")) return null;
  return draft.bookPath;
}

/** Build draft intent from proposeBooking tool output. */
export function voiceIntentFromProposeBookingOutput(output: {
  ok?: boolean;
  draft?: VoiceBookingDraft;
}): VoiceBookingIntent {
  if (!output?.ok || !output.draft?.bookPath) return { kind: "none" };
  return { kind: "propose_booking", draft: output.draft };
}
