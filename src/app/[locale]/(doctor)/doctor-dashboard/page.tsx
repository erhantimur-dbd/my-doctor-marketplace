import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Star, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { StartAppointmentButton } from "@/components/booking/start-appointment-button";

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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Today&apos;s Appointments
              </p>
              <p className="text-2xl font-bold">
                {todayBookings?.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{doctor.total_bookings}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
              <p className="text-2xl font-bold">
                {Number(doctor.avg_rating).toFixed(1)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{monthlyBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
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
