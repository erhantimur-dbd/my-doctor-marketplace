import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Video, User, MapPin, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Bookings",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingRow = any;

const UPCOMING_STATUSES = [
  "confirmed",
  "approved",
  "pending_payment",
  "pending_approval",
];
const PAST_STATUSES = [
  "completed",
  "cancelled_patient",
  "cancelled_doctor",
  "no_show",
  "refunded",
];

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
    case "approved":
      return "default";
    case "pending_payment":
    case "pending_approval":
      return "secondary";
    case "completed":
      return "outline";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "approved":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "pending_payment":
    case "pending_approval":
      return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    case "completed":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
    default:
      return "";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function BookingCard({
  booking,
  locale,
}: {
  booking: BookingRow;
  locale: string;
}) {
  const doctorName = `${booking.doctor.title || ""} ${booking.doctor.profile.first_name} ${booking.doctor.profile.last_name}`.trim();
  const startDate = new Date(booking.start_time);

  return (
    <Link href={`/dashboard/bookings/${booking.id}`}>
      <Card className="transition-all hover:border-primary/50 hover:shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Doctor info & time */}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between sm:justify-start sm:gap-3">
                <div>
                  <p className="font-semibold">{doctorName}</p>
                  {booking.doctor.clinic_name && (
                    <p className="text-sm text-muted-foreground">
                      {booking.doctor.clinic_name}
                    </p>
                  )}
                </div>
                <Badge
                  variant={getStatusBadgeVariant(booking.status)}
                  className={getStatusColor(booking.status)}
                >
                  {formatStatusLabel(booking.status)}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {startDate.toLocaleDateString(locale === "de" ? "de-DE" : locale === "tr" ? "tr-TR" : "en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {startDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <Badge variant="outline" className="text-xs">
                  {booking.consultation_type === "video" ? (
                    <>
                      <Video className="mr-1 h-3 w-3" />
                      Video Call
                    </>
                  ) : (
                    <>
                      <User className="mr-1 h-3 w-3" />
                      In Person
                    </>
                  )}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                Booking #{booking.booking_number}
              </p>
            </div>

            {/* Right: Price */}
            <div className="text-right">
              <p className="text-lg font-bold">
                {formatCurrency(
                  booking.total_amount_cents,
                  booking.currency,
                  locale
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface BookingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BookingsPage({ params }: BookingsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      start_time,
      end_time,
      status,
      consultation_type,
      consultation_fee_cents,
      platform_fee_cents,
      total_amount_cents,
      currency,
      patient_notes,
      created_at,
      doctor:doctors(
        slug, title, clinic_name,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url)
      )
    `
    )
    .eq("patient_id", user.id)
    .order("start_time", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Unable to load bookings. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typedBookings = (bookings || []) as unknown as BookingRow[];

  const upcomingBookings = typedBookings.filter((b) =>
    UPCOMING_STATUSES.includes(b.status)
  );
  const pastBookings = typedBookings.filter((b) =>
    PAST_STATUSES.includes(b.status)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Bookings</h1>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No upcoming bookings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You don&apos;t have any upcoming appointments scheduled.
                </p>
                <Button className="mt-6" asChild>
                  <Link href="/doctors">
                    <Search className="mr-2 h-4 w-4" />
                    Find a Doctor
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No past bookings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your completed and past bookings will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
