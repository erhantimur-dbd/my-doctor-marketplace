import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Calendar, Clock, ArrowRight } from "lucide-react";

export default async function PatientDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: upcomingBookings } = await supabase
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
    .limit(5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Welcome back, {profile?.first_name}
      </h1>

      {/* Upcoming bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
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
                No upcoming bookings
              </p>
              <Button className="mt-4" asChild>
                <Link href="/doctors">Find a Doctor</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(
                (booking: any) => (
                  <Link
                    key={booking.id}
                    href={`/dashboard/bookings/${booking.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">
                        {booking.doctor.title}{" "}
                        {booking.doctor.profile.first_name}{" "}
                        {booking.doctor.profile.last_name}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(booking.start_time).toLocaleDateString()} at{" "}
                        {new Date(booking.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
