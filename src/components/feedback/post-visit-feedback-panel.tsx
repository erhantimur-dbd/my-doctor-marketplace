import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/shared/star-rating";
import { PostVisitFeedbackForm } from "@/components/feedback/post-visit-feedback-form";
import {
  PLATFORM_FEEDBACK_DISCLAIMER,
  POST_VISIT_QUESTIONS,
} from "@/lib/feedback/post-visit";

export type SavedPlatformFeedback = {
  overall_rating: number;
  booking_experience_rating: number;
  waiting_room_rating: number;
  video_quality_rating: number;
  book_again_rating: number;
  has_private_note: boolean;
};

function savedRating(
  existing: SavedPlatformFeedback,
  column: (typeof POST_VISIT_QUESTIONS)[number]["column"]
): number {
  switch (column) {
    case "overall_rating":
      return existing.overall_rating;
    case "booking_experience_rating":
      return existing.booking_experience_rating;
    case "waiting_room_rating":
      return existing.waiting_room_rating;
    case "video_quality_rating":
      return existing.video_quality_rating;
    case "book_again_rating":
      return existing.book_again_rating;
  }
}

export function PostVisitFeedbackPanel({
  bookingId,
  existing,
}: {
  bookingId: string;
  existing: SavedPlatformFeedback | null;
}) {
  return (
    <Card data-testid="post-visit-feedback-panel">
      <CardHeader>
        <CardTitle className="text-base">Private platform feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {existing ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-sm">Thanks — your platform feedback is saved.</p>
            </div>
            <p className="text-sm text-muted-foreground">{PLATFORM_FEEDBACK_DISCLAIMER}</p>
            <div className="space-y-3">
              {POST_VISIT_QUESTIONS.map((question) => (
                <div
                  key={question.key}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm">{question.label}</p>
                  <StarRating rating={savedRating(existing, question.column)} />
                </div>
              ))}
            </div>
            {existing.has_private_note ? (
              <p className="text-sm text-muted-foreground">
                Your note is stored privately for a human check. It is not published.
              </p>
            ) : null}
          </div>
        ) : (
          <PostVisitFeedbackForm bookingId={bookingId} />
        )}
      </CardContent>
    </Card>
  );
}
