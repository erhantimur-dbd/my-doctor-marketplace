import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Star, MessageSquare, Clock } from "lucide-react";
import { WriteReviewDialog } from "./write-review-dialog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Reviews",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReviewRow = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PendingReviewBooking = any;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Fetch existing reviews by this patient
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      title,
      comment,
      doctor_response,
      created_at,
      booking_id,
      doctor:doctors(
        title, slug,
        profile:profiles(first_name, last_name)
      )
    `
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch completed bookings that don't have a review yet
  const reviewedBookingIds = (reviews || []).map(
    (r: { booking_id: string }) => r.booking_id
  );

  const { data: completedBookings } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      start_time,
      consultation_type,
      doctor_id,
      doctor:doctors(
        id, title, slug,
        profile:profiles(first_name, last_name)
      )
    `
    )
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .order("start_time", { ascending: false });

  const typedReviews = (reviews || []) as unknown as ReviewRow[];
  const typedBookings = (completedBookings ||
    []) as unknown as PendingReviewBooking[];

  // Filter out bookings that already have reviews
  const pendingReviewBookings = typedBookings.filter(
    (b) => !reviewedBookingIds.includes(b.id)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Reviews</h1>

      {/* Pending reviews section */}
      {pendingReviewBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Write a Review ({pendingReviewBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Share your experience to help other patients find the right doctor.
            </p>
            <div className="space-y-3">
              {pendingReviewBookings.map((booking) => {
                const doctorName = `${booking.doctor.title || ""} ${booking.doctor.profile.first_name} ${booking.doctor.profile.last_name}`.trim();
                const bookingDate = new Date(
                  booking.start_time
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{doctorName}</p>
                      <p className="text-sm text-muted-foreground">
                        {bookingDate} &middot;{" "}
                        {booking.consultation_type === "video"
                          ? "Video Call"
                          : "In Person"}{" "}
                        &middot; #{booking.booking_number}
                      </p>
                    </div>
                    <WriteReviewDialog
                      bookingId={booking.id}
                      doctorId={booking.doctor.id}
                      doctorName={doctorName}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Your Reviews ({typedReviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {typedReviews.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Star className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No reviews yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                After completing an appointment, you can leave a review to help
                other patients.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {typedReviews.map((review, index) => {
                const doctorName = `${review.doctor.title || ""} ${review.doctor.profile.first_name} ${review.doctor.profile.last_name}`.trim();
                const reviewDate = new Date(
                  review.created_at
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div key={review.id}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{doctorName}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <StarRating rating={review.rating} />
                            <span className="text-xs text-muted-foreground">
                              {reviewDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {review.title && (
                        <p className="font-medium">{review.title}</p>
                      )}

                      {review.comment && (
                        <p className="text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}

                      {review.doctor_response && (
                        <div className="mt-2 rounded-md bg-muted/50 p-3">
                          <p className="text-xs font-medium">
                            Doctor&apos;s Response
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {review.doctor_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
