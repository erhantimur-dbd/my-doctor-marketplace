import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  Video,
  User,
  Search,
  List,
  CalendarDays,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { CalendarView } from "./calendar-view";
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

const PER_PAGE = 20;

const BOOKING_SELECT = `
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
`;

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
  searchParams: Promise<{ view?: string; tab?: string; page?: string }>;
}

export default async function BookingsPage({
  params,
  searchParams,
}: BookingsPageProps) {
  const { locale } = await params;
  const { view: rawView, tab: rawTab, page: rawPage } = await searchParams;
  const view = rawView === "calendar" ? "calendar" : "list";
  const tab = rawTab === "past" ? "past" : "upcoming";
  const parsedPage = rawPage ? Number(rawPage) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  let calendarBookings: BookingRow[] = [];
  let tabBookings: BookingRow[] = [];
  let upcomingCount = 0;
  let pastCount = 0;
  let totalCount = 0;
  let fetchError = false;

  if (view === "calendar") {
    // Calendar renders all bookings at once, so cap the fetch to a sane maximum
    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("patient_id", user.id)
      .order("start_time", { ascending: false })
      .limit(500);

    if (error) fetchError = true;
    calendarBookings = (data || []) as unknown as BookingRow[];
  } else {
    const [upcomingRes, pastRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", user.id)
        .in("status", UPCOMING_STATUSES),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", user.id)
        .in("status", PAST_STATUSES),
    ]);

    if (upcomingRes.error || pastRes.error) {
      fetchError = true;
    } else {
      upcomingCount = upcomingRes.count ?? 0;
      pastCount = pastRes.count ?? 0;
      totalCount = tab === "past" ? pastCount : upcomingCount;

      const from = (page - 1) * PER_PAGE;
      if (from < totalCount) {
        const { data, error, count } = await supabase
          .from("bookings")
          .select(BOOKING_SELECT, { count: "exact" })
          .eq("patient_id", user.id)
          .in("status", tab === "past" ? PAST_STATUSES : UPCOMING_STATUSES)
          .order("start_time", { ascending: tab === "upcoming" })
          .range(from, from + PER_PAGE - 1);

        if (error) fetchError = true;
        tabBookings = (data || []) as unknown as BookingRow[];
        if (count !== null) totalCount = count;
      }
    }
  }

  if (fetchError) {
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

  const tabHref = (value: "upcoming" | "past") =>
    `/dashboard/bookings?tab=${value}${rawView ? `&view=${rawView}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Bookings</h1>

        {/* View toggle */}
        <div className="flex rounded-lg border p-0.5">
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            asChild
          >
            <Link href="/dashboard/bookings?view=list">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Link>
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            asChild
          >
            <Link href="/dashboard/bookings?view=calendar">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
          </Button>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView bookings={calendarBookings} locale={locale} />
      ) : (
        <Tabs value={tab}>
          <TabsList>
            <TabsTrigger value="upcoming" asChild>
              <Link href={tabHref("upcoming")}>
                Upcoming ({upcomingCount})
              </Link>
            </TabsTrigger>
            <TabsTrigger value="past" asChild>
              <Link href={tabHref("past")}>
                Past ({pastCount})
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {tabBookings.length === 0 ? (
              tab === "upcoming" ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">
                      No upcoming bookings
                    </h3>
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
                <Card>
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">
                      No past bookings
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your completed and past bookings will appear here.
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="space-y-3">
                {tabBookings.map((booking: BookingRow) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    locale={locale}
                  />
                ))}
              </div>
            )}

            {totalCount > PER_PAGE && (
              <div className="mt-8 flex justify-center gap-2">
                {Array.from(
                  { length: Math.ceil(totalCount / PER_PAGE) },
                  (_, i) => i + 1
                ).map((pageNumber) => (
                  <a
                    key={pageNumber}
                    href={`?${new URLSearchParams({
                      ...(rawView ? { view: rawView } : {}),
                      tab,
                      page: String(pageNumber),
                    }).toString()}`}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      pageNumber === page
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pageNumber}
                  </a>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
