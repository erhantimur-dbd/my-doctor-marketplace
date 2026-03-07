import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Star, DollarSign, Crown, ArrowRight, Clock, ShieldAlert, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { StartAppointmentButton } from "@/components/booking/start-appointment-button";
import { Link } from "@/i18n/navigation";

export default async function DoctorDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  // Check subscription status
  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("id, plan_id, status")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  const isFreeTier = !subscription;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .single();

  // Get today's bookings
  const today = new Date().toISOString().split("T")[0];
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select(
      "*, patient:profiles!bookings_patient_id_fkey(first_name, last_name)"
    )
    .eq("doctor_id", doctor.id)
    .eq("appointment_date", today)
    .in("status", ["confirmed", "approved"])
    .order("start_time");

  const now = new Date();

  // Get monthly stats
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();
  const { count: monthlyBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", doctor.id)
    .gte("created_at", startOfMonth)
    .in("status", ["confirmed", "approved", "completed"]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Welcome back, {profile?.first_name}
      </h1>

      {/* Verification Status Banners */}
      {doctor.verification_status === "pending" && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-blue-100 p-2.5 dark:bg-blue-900/50">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Account Pending GMC Verification
              </p>
              <p className="text-sm text-blue-800/80 dark:text-blue-200/70">
                Your GMC registration is being verified by our team. You&apos;ll receive an email once your account is approved.
                In the meantime, feel free to complete your profile.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {doctor.verification_status === "under_review" && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-orange-100 p-2.5 dark:bg-orange-900/50">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-100">
                Account Under Review
              </p>
              <p className="text-sm text-orange-800/80 dark:text-orange-200/70">
                Our team is currently reviewing your GMC registration. You&apos;ll be notified by email once the review is complete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {doctor.verification_status === "rejected" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-full bg-red-100 p-2.5 dark:bg-red-900/50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100">
                Verification Unsuccessful
              </p>
              <p className="text-sm text-red-800/80 dark:text-red-200/70">
                We were unable to verify your GMC registration. Please check your GMC reference number and contact support if you believe this is an error.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isFreeTier && doctor.verification_status === "verified" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2.5 dark:bg-amber-900/50">
                <Crown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  You&apos;re on the Free Plan
                </p>
                <p className="text-sm text-amber-800/80 dark:text-amber-200/70">
                  Your profile is live in our directory. Upgrade to unlock bookings, calendar, analytics, and more.
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/doctor-dashboard/subscription">
                Upgrade <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/doctor-dashboard/bookings" className="group">
          <Card className="transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-blue-50 p-3">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Today&apos;s Appointments
                </p>
                <p className="text-2xl font-bold">
                  {todayBookings?.length || 0}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/doctor-dashboard/bookings" className="group">
          <Card className="transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-green-50 p-3">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{doctor.total_bookings}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/doctor-dashboard/reviews" className="group">
          <Card className="transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-yellow-50 p-3">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold">
                  {Number(doctor.avg_rating).toFixed(1)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/doctor-dashboard/analytics" className="group">
          <Card className="transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-purple-50 p-3">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{monthlyBookings || 0}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today&apos;s Schedule</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/doctor-dashboard/calendar">
              View Calendar <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!todayBookings || todayBookings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No appointments today
            </p>
          ) : (
            <div className="space-y-3">
              {todayBookings.map(
                (booking: any) => {
                  const startDt = new Date(`${booking.appointment_date}T${booking.start_time}`);
                  const minsBefore = (startDt.getTime() - now.getTime()) / 60000;
                  const joinEnabled = booking.consultation_type === "video" &&
                    booking.video_room_url &&
                    minsBefore <= 10 && minsBefore >= -60;

                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {booking.patient.first_name}{" "}
                          {booking.patient.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {booking.consultation_type === "video" && booking.video_room_url && (
                          <StartAppointmentButton
                            videoRoomUrl={booking.video_room_url}
                            appointmentDate={booking.appointment_date}
                            startTime={booking.start_time}
                          />
                        )}
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {booking.consultation_type === "video"
                            ? "Video"
                            : "In Person"}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
