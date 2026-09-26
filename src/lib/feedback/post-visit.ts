/**
 * Private Softsmoke post-visit platform feedback.
 *
 * Not the public `reviews` pipeline: that table auto-approves into
 * `is_visible` and `update_doctor_rating` writes `doctors.avg_rating`.
 * Not `satisfaction_surveys`: that is an emailed 0–10 NPS instrument
 * (Soft CTA email is on HOLD).
 *
 * This rates the MyDoctors360 booking and video platform only.
 * Free text lives in `post_visit_feedback_notes` and is not selected here.
 */

import {
  isSoftLaunchSoftsmokeDoctor,
  SOFT_LAUNCH_SOFTSMOKE_DOCTOR,
} from "@/lib/soft-launch/softsmoke-connect-bypass";

export const POST_VISIT_STAR_MIN = 1;
export const POST_VISIT_STAR_MAX = 5;
export const POST_VISIT_FREE_TEXT_MAX = 2000;

export const PLATFORM_FEEDBACK_DISCLAIMER =
  "This rates your MyDoctors360 booking and video platform experience only. It is not a rating of clinical care, symptoms, records, or treatment, and it is not shown on the doctor's public profile.";

export const PLATFORM_FEEDBACK_NOTE_LABEL = "Optional note (private)";

export const PLATFORM_FEEDBACK_NOTE_PLACEHOLDER =
  "Optional. Booking or video only — do not include symptoms, records, or treatment. This note is stored for a human check and is not published.";

export const PUBLIC_REVIEW_BLOCKED_MESSAGE =
  "This Softsmoke visit uses private platform feedback. It is not published on the doctor profile.";

export const POST_VISIT_QUESTIONS = [
  {
    key: "overallRating",
    column: "overall_rating",
    rpc: "p_overall",
    label: "Overall platform experience",
    prompt: "How was your overall MyDoctors360 platform experience?",
  },
  {
    key: "bookingExperienceRating",
    column: "booking_experience_rating",
    rpc: "p_booking_experience",
    label: "Booking experience",
    prompt: "How was booking this visit on MyDoctors360?",
  },
  {
    key: "waitingRoomRating",
    column: "waiting_room_rating",
    rpc: "p_waiting_room",
    label: "Waiting room",
    prompt: "How was the video waiting room?",
  },
  {
    key: "videoQualityRating",
    column: "video_quality_rating",
    rpc: "p_video_quality",
    label: "Video quality",
    prompt: "How was the video quality?",
  },
  {
    key: "bookAgainRating",
    column: "book_again_rating",
    rpc: "p_book_again",
    label: "Book again",
    prompt: "Would you book this doctor again on MyDoctors360?",
  },
] as const;

export type PostVisitRatingKey = (typeof POST_VISIT_QUESTIONS)[number]["key"];

export type PostVisitRatings = Record<PostVisitRatingKey, number>;

/** Doctor-private scores only. Notes and the private-note flag stay off this select. */
export const DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT = `
  id,
  created_at,
  overall_rating,
  booking_experience_rating,
  waiting_room_rating,
  video_quality_rating,
  book_again_rating,
  booking:bookings!post_visit_feedback_booking_id_fkey(booking_number, start_time)
`;

/** Patient confirmation. Free text is never selected. */
export const PATIENT_PLATFORM_FEEDBACK_SELECT =
  "id, created_at, overall_rating, booking_experience_rating, waiting_room_rating, video_quality_rating, book_again_rating, has_private_note";

export type PlatformFeedbackPromptBooking = {
  id: string;
  bookingNumber?: string | null;
  startTime?: string | null;
  status?: string | null;
  consultationType?: string | null;
  doctorId?: string | null;
  doctorSlug?: string | null;
};

export type PostVisitFeedbackInput = {
  bookingId?: string | null;
  overallRating?: number | null;
  bookingExperienceRating?: number | null;
  waitingRoomRating?: number | null;
  videoQualityRating?: number | null;
  bookAgainRating?: number | null;
  freeText?: string | null;
};

export type ParsedPostVisitFeedback = {
  bookingId: string;
  ratings: PostVisitRatings;
  freeText: string | null;
};

export type PlatformFeedbackRpcArgs = {
  p_booking_id: string;
  p_overall: number;
  p_booking_experience: number;
  p_waiting_room: number;
  p_video_quality: number;
  p_book_again: number;
  p_free_text: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStarRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= POST_VISIT_STAR_MIN &&
    value <= POST_VISIT_STAR_MAX
  );
}

export function normalizePlatformFeedbackNote(
  value: unknown
): { text: string | null } | { error: string } {
  if (value == null) return { text: null };
  if (typeof value !== "string") return { error: "Feedback note must be text." };
  const trimmed = value.trim();
  if (!trimmed) return { text: null };
  if (trimmed.length > POST_VISIT_FREE_TEXT_MAX) {
    return {
      error: `Feedback note must be ${POST_VISIT_FREE_TEXT_MAX} characters or fewer.`,
    };
  }
  return { text: trimmed };
}

/**
 * Prompt gate for a completed Softsmoke video visit.
 * Slug is checked when the booking embed includes it. Email is checked
 * on submit via `isSoftLaunchSoftsmokeDoctor`, not in the prompt.
 */
export function shouldPromptSoftsmokePlatformFeedback(
  booking: PlatformFeedbackPromptBooking
): boolean {
  if (booking.status !== "completed") return false;
  if (booking.consultationType !== "video") return false;
  if (booking.doctorId !== SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id) return false;
  if (
    booking.doctorSlug &&
    booking.doctorSlug !== SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug
  ) {
    return false;
  }
  return true;
}

export function pendingPlatformFeedback(
  bookings: PlatformFeedbackPromptBooking[],
  submittedBookingIds: Iterable<string>
): PlatformFeedbackPromptBooking[] {
  const submitted = new Set(submittedBookingIds);
  return bookings.filter(
    (booking) =>
      shouldPromptSoftsmokePlatformFeedback(booking) && !submitted.has(booking.id)
  );
}

export function embeddedDoctorSlug(doctor: unknown): string | null {
  const row = Array.isArray(doctor) ? doctor[0] : doctor;
  if (!row || typeof row !== "object" || !("slug" in row)) return null;
  const slug = (row as { slug?: unknown }).slug;
  return typeof slug === "string" ? slug : null;
}

export function toPlatformFeedbackPrompt(row: {
  id: string;
  booking_number?: string | null;
  start_time?: string | null;
  status?: string | null;
  consultation_type?: string | null;
  doctor_id?: string | null;
  doctor?: unknown;
}): PlatformFeedbackPromptBooking {
  return {
    id: row.id,
    bookingNumber: row.booking_number ?? null,
    startTime: row.start_time ?? null,
    status: row.status ?? null,
    consultationType: row.consultation_type ?? null,
    doctorId: row.doctor_id ?? null,
    doctorSlug: embeddedDoctorSlug(row.doctor),
  };
}

/** Public doctor reviews stay off the Softsmoke tester profile. */
export function isSoftsmokePublicReviewBlocked(
  doctorId: string | null | undefined
): boolean {
  return doctorId === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id;
}

export function submitIdentityMatchesSoftsmokeDoctor(doctor: {
  id?: string | null;
  slug?: string | null;
  email?: string | null;
}): boolean {
  return isSoftLaunchSoftsmokeDoctor(doctor);
}

export function parsePostVisitFeedbackSubmission(
  input: PostVisitFeedbackInput
): { ok: true; value: ParsedPostVisitFeedback } | { ok: false; error: string } {
  const bookingId = input.bookingId?.trim() ?? "";
  if (!UUID_RE.test(bookingId)) {
    return { ok: false, error: "Booking not found." };
  }

  const ratings = {
    overallRating: input.overallRating,
    bookingExperienceRating: input.bookingExperienceRating,
    waitingRoomRating: input.waitingRoomRating,
    videoQualityRating: input.videoQualityRating,
    bookAgainRating: input.bookAgainRating,
  };

  for (const question of POST_VISIT_QUESTIONS) {
    if (!isStarRating(ratings[question.key])) {
      return {
        ok: false,
        error: `Choose 1 to 5 stars for ${question.label.toLowerCase()}.`,
      };
    }
  }

  const note = normalizePlatformFeedbackNote(input.freeText);
  if ("error" in note) return { ok: false, error: note.error };

  return {
    ok: true,
    value: {
      bookingId,
      ratings: ratings as PostVisitRatings,
      freeText: note.text,
    },
  };
}

export function toPlatformFeedbackRpcArgs(
  value: ParsedPostVisitFeedback
): PlatformFeedbackRpcArgs {
  return {
    p_booking_id: value.bookingId,
    p_overall: value.ratings.overallRating,
    p_booking_experience: value.ratings.bookingExperienceRating,
    p_waiting_room: value.ratings.waitingRoomRating,
    p_video_quality: value.ratings.videoQualityRating,
    p_book_again: value.ratings.bookAgainRating,
    p_free_text: value.freeText,
  };
}
