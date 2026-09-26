import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/shared/star-rating";
import {
  DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT,
  PLATFORM_FEEDBACK_DISCLAIMER,
  POST_VISIT_QUESTIONS,
} from "@/lib/feedback/post-visit";

type FeedbackRow = {
  id: string;
  created_at: string;
  overall_rating: number;
  booking_experience_rating: number;
  waiting_room_rating: number;
  video_quality_rating: number;
  book_again_rating: number;
  booking:
    | { booking_number?: string | null; start_time?: string | null }
    | { booking_number?: string | null; start_time?: string | null }[]
    | null;
};

export async function DoctorPrivatePlatformFeedback({
  doctorId,
}: {
  doctorId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_visit_feedback")
    .select(DOCTOR_PRIVATE_PLATFORM_FEEDBACK_SELECT)
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (data ?? []) as unknown as FeedbackRow[];

  return (
    <Card data-testid="doctor-private-platform-feedback">
      <CardHeader>
        <CardTitle className="text-base">
          Private platform feedback (Softsmoke)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {PLATFORM_FEEDBACK_DISCLAIMER} Stars here are not your public profile
          rating.
        </p>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Private feedback could not be loaded.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No private platform feedback yet. It appears here after a completed
            Softsmoke video visit.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const booking = Array.isArray(row.booking) ? row.booking[0] : row.booking;
              const when = booking?.start_time
                ? new Date(booking.start_time).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : new Date(row.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
              return (
                <div key={row.id} className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">
                    {when}
                    {booking?.booking_number ? ` · #${booking.booking_number}` : ""}
                  </p>
                  {POST_VISIT_QUESTIONS.map((question) => (
                    <div
                      key={question.key}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-sm text-muted-foreground">{question.label}</p>
                      <StarRating rating={Number(row[question.column] ?? 0)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
