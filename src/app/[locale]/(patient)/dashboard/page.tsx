import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  Calendar,
  Clock,
  Search,
  ClipboardList,
  Settings,
  CreditCard,
  ArrowRight,
  Bell,
  Video,
  MapPin,
} from "lucide-react";
import { OnboardingTour } from "@/components/shared/onboarding-tour";
import { patientDashboardSteps } from "@/components/shared/onboarding-steps";

function getCountdownBadge(startTime: string) {
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = start.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Today
      </Badge>
    );
  }
  if (diffDays === 1) {
    return (
      <Badge variant="secondary" className="text-xs">
        Tomorrow
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      In {diffDays} days
    </Badge>
  );
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "booking_confirmed":
    case "booking_approved":
    case "booking_reminder":
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case "booking_cancelled":
    case "booking_rejected":
      return <Calendar className="h-4 w-4 text-red-500" />;
    case "payment":
    case "refund":
      return <CreditCard className="h-4 w-4 text-green-500" />;
    case "treatment_plan":
      return <ClipboardList className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default async function PatientDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Fetch profile, KPI counts, spending, favorites, upcoming bookings, and notifications in parallel
  const [
    { data: profile },
    { data: upcomingBookings },
    { data: notifications },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select(
        `
        *,
        doctor:doctors(
          slug, title, clinic_name,
          profile:profiles(first_name, last_name)
        )
      `
      )
      .eq("patient_id", user.id)
      .in("status", ["confirmed", "approved"])
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const quickActions = [
    {
      href: "/doctors" as const,
      icon: Search,
      label: "Find a Doctor",
      description: "Browse and book appointments",
      color: "bg-blue-50 text-blue-600",
    },
    {
      href: "/dashboard/bookings" as const,
      icon: Calendar,
      label: "My Bookings",
      description: "View and manage appointments",
      color: "bg-green-50 text-green-600",
    },
    {
      href: "/dashboard/treatment-plans" as const,
      icon: ClipboardList,
      label: "Treatment Plans",
      description: "View doctor recommendations",
      color: "bg-purple-50 text-purple-600",
    },
    {
      href: "/dashboard/settings" as const,
      icon: Settings,
      label: "Settings",
      description: "Update your profile & preferences",
      color: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <OnboardingTour tourId="patient-dashboard" steps={patientDashboardSteps} />

      <h1 className="text-2xl font-bold">
        Welcome back, {profile?.first_name}
      </h1>

      {/* Quick Actions */}
      <div data-tour="patient-quick-actions">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={`rounded-full p-2.5 ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{action.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <Card data-tour="patient-upcoming">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/bookings">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!upcomingBookings || upcomingBookings.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No upcoming appointments
              </p>
              <Button className="mt-4" asChild>
                <Link href="/doctors">Find a Doctor</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking: any) => {
                const doctor: any = Array.isArray(booking.doctor)
                  ? booking.doctor[0]
                  : booking.doctor;
                const doctorProfile: any = doctor
                  ? Array.isArray(doctor.profile)
                    ? doctor.profile[0]
                    : doctor.profile
                  : null;

                return (
                  <Link
                    key={booking.id}
                    href={`/dashboard/bookings/${booking.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {doctor?.title}{" "}
                          {doctorProfile?.first_name}{" "}
                          {doctorProfile?.last_name}
                        </p>
                        {booking.consultation_type === "video" ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <Video className="h-3 w-3" />
                            Video
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            In-Person
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(booking.start_time).toLocaleDateString(
                            "en-GB",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            }
                          )}{" "}
                          at{" "}
                          {new Date(booking.start_time).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCountdownBadge(booking.start_time)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card data-tour="patient-activity">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/messages">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!notifications || notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No recent activity
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    !notification.read ? "bg-accent/50" : ""
                  }`}
                >
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.body && (
                      <p className="mt-0.5 text-sm text-muted-foreground truncate">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
