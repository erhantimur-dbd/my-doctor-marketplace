import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { PLATFORM_FEEDBACK_DISCLAIMER } from "@/lib/feedback/post-visit";

export function PatientPlatformFeedbackPrompt({
  bookings,
}: {
  bookings: {
    id: string;
    bookingNumber?: string | null;
    startTime?: string | null;
  }[];
}) {
  if (bookings.length === 0) return null;

  return (
    <Card data-testid="patient-platform-feedback-prompt">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-4 w-4" />
          Private platform feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{PLATFORM_FEEDBACK_DISCLAIMER}</p>
        <div className="space-y-3">
          {bookings.map((booking) => {
            const when = booking.startTime
              ? new Date(booking.startTime).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null;
            return (
              <div
                key={booking.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">Completed video visit</p>
                  <p className="text-sm text-muted-foreground">
                    {when ? `${when} · ` : ""}
                    {booking.bookingNumber ? `#${booking.bookingNumber}` : "Softsmoke"}
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/bookings/${booking.id}`}>
                    Share platform feedback
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
