import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  DollarSign,
  Star,
  Users,
  Video,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { hasActiveLicense } from "@/lib/license/check";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { DayOfWeekChart } from "@/components/charts/day-of-week-chart";
import { ConsultationPieChart } from "@/components/charts/consultation-pie-chart";
import { StatusPieChart } from "@/components/charts/status-pie-chart";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, base_currency, avg_rating, total_reviews, total_bookings"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  if (!(await hasActiveLicense(supabase, doctor.id))) {
    return <UpgradePrompt feature="Analytics" />;
  }

  const currency = doctor.base_currency || "EUR";
  const now = new Date();

  // --- This month's bookings ---
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const { data: monthBookings } = await supabase
    .from("bookings")
    .select(
      "total_amount_cents, platform_fee_cents, consultation_type, appointment_date, status, patient_id"
    )
    .eq("doctor_id", doctor.id)
    .gte("appointment_date", startOfMonth)
    .lte("appointment_date", endOfMonth);

  const activeMonthBookings = (monthBookings || []).filter((b) =>
    ["confirmed", "approved", "completed"].includes(b.status)
  );

  const thisMonthRevenue = activeMonthBookings.reduce(
    (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );

  const thisMonthBookingCount = activeMonthBookings.length;

  // --- Unique patients (all time) ---
  const { data: allPatientBookings } = await supabase
    .from("bookings")
    .select("patient_id")
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  const uniquePatients = new Set(
    (allPatientBookings || []).map((b) => b.patient_id)
  ).size;

  // --- Monthly bookings + revenue for past 6 months ---
  const monthlyData: {
    month: string;
    bookings: number;
    revenue: number;
  }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const { data: mBookings } = await supabase
      .from("bookings")
      .select("total_amount_cents, platform_fee_cents")
      .eq("doctor_id", doctor.id)
      .gte("appointment_date", mStart)
      .lte("appointment_date", mEnd)
      .in("status", ["confirmed", "approved", "completed"]);

    const mRevenue = (mBookings || []).reduce(
      (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
      0
    );

    monthlyData.push({
      month: d.toLocaleDateString("en-GB", { month: "short" }),
      bookings: mBookings?.length || 0,
      revenue: mRevenue,
    });
  }

  const maxMonthlyBookings = Math.max(
    ...monthlyData.map((m) => m.bookings),
    1
  );
  const maxMonthlyRevenue = Math.max(
    ...monthlyData.map((m) => m.revenue),
    1
  );

  // --- All-time booking status breakdown ---
  const { data: allBookings } = await supabase
    .from("bookings")
    .select("consultation_type, status")
    .eq("doctor_id", doctor.id);

  const totalAll = allBookings?.length || 0;
  const completedCount =
    allBookings?.filter((b) => b.status === "completed").length || 0;
  const confirmedCount =
    allBookings?.filter((b) =>
      ["confirmed", "approved"].includes(b.status)
    ).length || 0;
  const cancelledCount =
    allBookings?.filter((b) =>
      ["cancelled_patient", "cancelled_doctor"].includes(b.status)
    ).length || 0;
  const noShowCount =
    allBookings?.filter((b) => b.status === "no_show").length || 0;

  // Consultation type breakdown (from successful bookings only)
  const successfulBookings = (allBookings || []).filter((b) =>
    ["confirmed", "approved", "completed"].includes(b.status)
  );
  const totalSuccessful = successfulBookings.length;
  const videoCount = successfulBookings.filter(
    (b) => b.consultation_type === "video"
  ).length;
  const inPersonCount = totalSuccessful - videoCount;
  const videoPct =
    totalSuccessful > 0
      ? Math.round((videoCount / totalSuccessful) * 100)
      : 0;
  const inPersonPct = totalSuccessful > 0 ? 100 - videoPct : 0;

  // Completion rate
  const completionRate =
    totalAll > 0 ? Math.round((completedCount / totalAll) * 100) : 0;

  // --- Recent reviews ---
  const { data: recentReviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, title, comment, created_at, patient_id, booking_id"
    )
    .eq("doctor_id", doctor.id)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(5);

  // Get patient names for recent reviews
  let reviewsWithPatients: {
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    created_at: string;
    patientName: string;
  }[] = [];

  if (recentReviews && recentReviews.length > 0) {
    const patientIds = [...new Set(recentReviews.map((r) => r.patient_id))];
    const { data: patients } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", patientIds);

    const patientMap = new Map(
      (patients || []).map((p) => [
        p.id,
        `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Anonymous",
      ])
    );

    reviewsWithPatients = recentReviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      created_at: r.created_at,
      patientName: patientMap.get(r.patient_id) || "Anonymous",
    }));
  }

  // --- Busiest days of week ---
  const { data: dayBookings } = await supabase
    .from("bookings")
    .select("appointment_date")
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  (dayBookings || []).forEach((b) => {
    const day = new Date(b.appointment_date).getDay();
    dayOfWeekCounts[day]++;
  });
  const maxDayCount = Math.max(...dayOfWeekCounts, 1);

  // --- Average booking value (all time, successful bookings) ---
  const { data: revenueBookings } = await supabase
    .from("bookings")
    .select("total_amount_cents, platform_fee_cents")
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  const totalRevenue = (revenueBookings || []).reduce(
    (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );
  const avgBookingValue =
    revenueBookings && revenueBookings.length > 0
      ? Math.round(totalRevenue / revenueBookings.length)
      : 0;

  // --- Repeat patient rate ---
  const patientBookingCounts = new Map<string, number>();
  (allPatientBookings || []).forEach((b) => {
    patientBookingCounts.set(
      b.patient_id,
      (patientBookingCounts.get(b.patient_id) || 0) + 1
    );
  });
  const repeatPatients = [...patientBookingCounts.values()].filter(
    (count) => count > 1
  ).length;
  const repeatRate =
    uniquePatients > 0
      ? Math.round((repeatPatients / uniquePatients) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Insights into your practice performance
        </p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{doctor.total_bookings}</p>
              <p className="text-xs text-muted-foreground">
                {thisMonthBookingCount} this month
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
              <p className="text-sm text-muted-foreground">
                Revenue This Month
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(thisMonthRevenue, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalRevenue, currency)} all time
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">
                {Number(doctor.avg_rating).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">
                {doctor.total_reviews} reviews
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
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold">{uniquePatients}</p>
              <p className="text-xs text-muted-foreground">
                {repeatRate}% return rate
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-emerald-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-orange-50 p-3">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Avg Booking Value
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(avgBookingValue, currency)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-indigo-50 p-3">
              <Repeat className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Repeat Patients</p>
              <p className="text-2xl font-bold">{repeatPatients}</p>
              <p className="text-xs text-muted-foreground">
                out of {uniquePatients} total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Bookings Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Bookings (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart
            data={monthlyData.map((m) => ({ month: m.month, value: m.bookings }))}
            color="hsl(var(--primary))"
          />
        </CardContent>
      </Card>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Revenue (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart
            data={monthlyData.map((m) => ({ month: m.month, value: m.revenue }))}
            color="#22c55e"
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Booking Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Consultation Types</CardTitle>
          </CardHeader>
          <CardContent>
            {totalSuccessful === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No bookings data yet
              </p>
            ) : (
              <ConsultationPieChart
                inPersonCount={inPersonCount}
                videoCount={videoCount}
              />
            )}
          </CardContent>
        </Card>

        {/* Booking Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {totalAll === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No bookings data yet
              </p>
            ) : (
              <StatusPieChart
                completedCount={completedCount}
                confirmedCount={confirmedCount}
                cancelledCount={cancelledCount}
                noShowCount={noShowCount}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Busiest Days of the Week */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Busiest Days of the Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DayOfWeekChart
            data={dayNames.map((day, idx) => ({
              day,
              count: dayOfWeekCounts[idx],
            }))}
          />
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Recent Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsWithPatients.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No reviews yet. Reviews will appear here after patients complete
              their appointments.
            </p>
          ) : (
            <div className="space-y-4">
              {reviewsWithPatients.map((review) => (
                <div key={review.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {review.patientName}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  {review.title && (
                    <p className="text-sm font-medium">{review.title}</p>
                  )}
                  {review.comment && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
