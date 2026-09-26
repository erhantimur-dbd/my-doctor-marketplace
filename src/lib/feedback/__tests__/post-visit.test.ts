import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOFT_LAUNCH_SOFTSMOKE_DOCTOR } from "@/lib/soft-launch/softsmoke-connect-bypass";
import {
  DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT,
  PATIENT_PLATFORM_FEEDBACK_SELECT,
  PLATFORM_FEEDBACK_DISCLAIMER,
  POST_VISIT_QUESTIONS,
  isSoftsmokePublicReviewBlocked,
  parsePostVisitFeedbackSubmission,
  pendingPlatformFeedback,
  shouldPromptSoftsmokePlatformFeedback,
  submitIdentityMatchesSoftsmokeDoctor,
  toPlatformFeedbackPrompt,
  toPlatformFeedbackRpcArgs,
} from "@/lib/feedback/post-visit";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const completedVideo = {
  id: BOOKING_ID,
  booking_number: "MD-100",
  start_time: "2026-09-20T10:00:00.000Z",
  status: "completed",
  consultation_type: "video",
  doctor_id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
  doctor: {
    id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
    slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
  },
};

describe("softsmoke private post-visit feedback", () => {
  it("accepts a completed video visit with stars and an optional private note", () => {
    const prompt = toPlatformFeedbackPrompt(completedVideo);
    expect(shouldPromptSoftsmokePlatformFeedback(prompt)).toBe(true);
    expect(pendingPlatformFeedback([prompt], [])).toEqual([prompt]);
    expect(pendingPlatformFeedback([prompt], [BOOKING_ID])).toEqual([]);

    const parsed = parsePostVisitFeedbackSubmission({
      bookingId: BOOKING_ID,
      overallRating: 5,
      bookingExperienceRating: 4,
      waitingRoomRating: 3,
      videoQualityRating: 5,
      bookAgainRating: 4,
      freeText: "  Waiting room was clear.  ",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.freeText).toBe("Waiting room was clear.");
    expect(parsed.value.ratings).toEqual({
      overallRating: 5,
      bookingExperienceRating: 4,
      waitingRoomRating: 3,
      videoQualityRating: 5,
      bookAgainRating: 4,
    });
    expect(toPlatformFeedbackRpcArgs(parsed.value)).toEqual({
      p_booking_id: BOOKING_ID,
      p_overall: 5,
      p_booking_experience: 4,
      p_waiting_room: 3,
      p_video_quality: 5,
      p_book_again: 4,
      p_free_text: "Waiting room was clear.",
    });
    expect(
      submitIdentityMatchesSoftsmokeDoctor({
        id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
        email: ` ${SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email.toUpperCase()} `,
      })
    ).toBe(true);
  });

  it("stores a blank note as no note and keeps every question on a 1–5 star scale", () => {
    const parsed = parsePostVisitFeedbackSubmission({
      bookingId: BOOKING_ID,
      overallRating: 1,
      bookingExperienceRating: 2,
      waitingRoomRating: 3,
      videoQualityRating: 4,
      bookAgainRating: 5,
      freeText: "   ",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.freeText).toBeNull();
    expect(toPlatformFeedbackRpcArgs(parsed.value).p_free_text).toBeNull();

    expect(POST_VISIT_QUESTIONS.map((question) => question.prompt)).toEqual([
      "How was your overall MyDoctors360 platform experience?",
      "How was booking this visit on MyDoctors360?",
      "How was the video waiting room?",
      "How was the video quality?",
      "Would you book this doctor again on MyDoctors360?",
    ]);
    expect(PLATFORM_FEEDBACK_DISCLAIMER).toMatch(/platform experience only/i);
    expect(PLATFORM_FEEDBACK_DISCLAIMER).toMatch(/not shown on the doctor's public profile/i);
    expect(PLATFORM_FEEDBACK_DISCLAIMER).toMatch(/not a rating of clinical care/i);
  });

  it("rejects visits that are not a completed Softsmoke video, and ratings outside 1–5", () => {
    expect(
      shouldPromptSoftsmokePlatformFeedback({
        ...toPlatformFeedbackPrompt(completedVideo),
        status: "confirmed",
      })
    ).toBe(false);
    expect(
      shouldPromptSoftsmokePlatformFeedback({
        ...toPlatformFeedbackPrompt(completedVideo),
        consultationType: "in_person",
      })
    ).toBe(false);
    expect(
      shouldPromptSoftsmokePlatformFeedback({
        ...toPlatformFeedbackPrompt(completedVideo),
        doctorId: "22222222-2222-4222-8222-222222222222",
      })
    ).toBe(false);
    expect(
      shouldPromptSoftsmokePlatformFeedback({
        ...toPlatformFeedbackPrompt(completedVideo),
        doctorSlug: "someone-else",
      })
    ).toBe(false);
    expect(
      submitIdentityMatchesSoftsmokeDoctor({
        id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
        email: "other@example.com",
      })
    ).toBe(false);

    const missing = parsePostVisitFeedbackSubmission({
      bookingId: BOOKING_ID,
      overallRating: 5,
      bookingExperienceRating: 5,
      waitingRoomRating: 0,
      videoQualityRating: 5,
      bookAgainRating: 5,
    });
    expect(missing.ok).toBe(false);

    const tooLong = parsePostVisitFeedbackSubmission({
      bookingId: BOOKING_ID,
      overallRating: 5,
      bookingExperienceRating: 5,
      waitingRoomRating: 5,
      videoQualityRating: 5,
      bookAgainRating: 5,
      freeText: "x".repeat(2001),
    });
    expect(tooLong.ok).toBe(false);
  });

  it("keeps free text off the doctor-private and public-profile selects", () => {
    expect(DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT).not.toMatch(
      /free_text|post_visit_feedback_notes|has_private_note/
    );
    expect(PATIENT_PLATFORM_FEEDBACK_SELECT).not.toMatch(/free_text/);
    expect(PATIENT_PLATFORM_FEEDBACK_SELECT).toContain("has_private_note");
    expect(isSoftsmokePublicReviewBlocked(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id)).toBe(
      true
    );
    expect(isSoftsmokePublicReviewBlocked("22222222-2222-4222-8222-222222222222")).toBe(
      false
    );
  });

  it("does not wire feedback into the public profile, review emails, or Connect bypass", () => {
    const profile = read("src/app/[locale]/(public)/doctors/[slug]/page.tsx");
    expect(profile).not.toContain("post_visit_feedback");
    expect(profile).not.toContain("booking_experience_rating");

    const action = read("src/actions/post-visit-feedback.ts");
    expect(action).not.toMatch(
      /sendEmail|satisfactionSurveyEmail|reviewRequestEmail|reviewReceivedEmail/
    );
    expect(action).not.toContain("isSoftsmokeConnectChargeSkipped");
    expect(action).not.toContain("allowsSoftLaunchSoftsmokeConnectBypass");
    expect(action).not.toContain('.from("reviews")');
    expect(action).toContain("submit_post_visit_platform_feedback");
    expect(action).toContain("submitIdentityMatchesSoftsmokeDoctor");

    for (const rel of [
      "src/actions/reviews.ts",
      "src/app/[locale]/(patient)/dashboard/reviews/actions.ts",
    ]) {
      expect(read(rel)).toContain("isSoftsmokePublicReviewBlocked");
    }

    for (const rel of [
      "src/app/api/cron/satisfaction-surveys/route.ts",
      "src/app/api/cron/request-reviews/route.ts",
    ]) {
      const source = read(rel);
      expect(source).not.toContain("post_visit_feedback");
      expect(source).toContain("doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(");
    }

    const bypass = read("src/lib/soft-launch/softsmoke-connect-bypass.ts");
    expect(bypass).toContain("isSoftsmokeConnectChargeSkipped");
    expect(read("src/lib/feedback/post-visit.ts")).not.toContain(
      "isSoftsmokeConnectChargeSkipped"
    );
    expect(read("src/lib/feedback/post-visit.ts")).not.toContain(
      "allowsSoftLaunchSoftsmokeConnectBypass"
    );

    const migration = read(
      "supabase/migrations/00112_post_visit_platform_feedback.sql"
    );
    const migrationSql = migration.replace(/--.*$/gm, "");
    expect(migrationSql).not.toMatch(/update_doctor_rating|\bis_visible\b/);
    expect(migrationSql).not.toMatch(/UPDATE\s+public\.doctors|SET\s+avg_rating/i);
    expect(migration).toContain("post_visit_feedback_notes");
    expect(migration).toContain("checked_at");
    expect(migration).toContain("checked_by");
    expect(migration).toContain(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id);
    expect(migration).toContain(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug);
    expect(migration).toContain(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.submit_post_visit_platform_feedback");
    expect(migration).not.toMatch(/sendEmail|pg_net|net\.http_post/i);
    expect(migration).toContain("No doctor policy");
    expect(migration).toMatch(/BEFORE INSERT ON public\.reviews/);
    expect(migration).not.toMatch(/BEFORE INSERT OR UPDATE ON public\.reviews/);

    const form = read("src/components/feedback/post-visit-feedback-form.tsx");
    expect(form).toContain("POST_VISIT_QUESTIONS");
    expect(form).toContain("PLATFORM_FEEDBACK_DISCLAIMER");
    expect(form).not.toMatch(/sendEmail/);

    const doctorView = read(
      "src/components/feedback/doctor-private-platform-feedback.tsx"
    );
    expect(doctorView).toContain("DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT");
    expect(doctorView).not.toContain("post_visit_feedback_notes");
    expect(doctorView).not.toContain("free_text");

    const detail = read(
      "src/app/[locale]/(patient)/dashboard/bookings/[id]/page.tsx"
    );
    expect(detail).toContain("BOOKING_CURRENT_DOCTOR_EMBED");
    expect(detail).toContain("PostVisitFeedbackPanel");
    expect(detail).toContain("isSoftsmokePublicReviewBlocked");
    expect(detail).not.toMatch(/doctor:doctors\(/);

    const dashboard = read("src/app/[locale]/(patient)/dashboard/page.tsx");
    expect(dashboard).toContain("PatientPlatformFeedbackPrompt");
    expect(dashboard).toContain("BOOKING_CURRENT_DOCTOR_EMBED");
    expect(dashboard).not.toContain("isSoftsmokeConnectChargeSkipped");
    expect(dashboard).not.toMatch(/doctor:doctors\(/);
  });
});
