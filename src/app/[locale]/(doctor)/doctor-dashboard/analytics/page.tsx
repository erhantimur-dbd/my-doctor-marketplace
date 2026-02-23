import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  DollarSign,
  Star,
  Eye,
  Video,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

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

  const currency = doctor.base_currency || "EUR";

  // Get this month's revenue
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0];

  const { data: monthBookings } = await supabase
    .from("bookings")
    .select("total_amount_cents, platform_fee_cents, consultation_type, appointment_date")
    .eq("doctor_id", doctor.id)
    .gte("appointment_date", startOfMonth)
    .in("status", ["confirmed", "approved", "completed"]);

  const thisMonthRevenue = (monthBookings || []).reduce(
    (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );

  // Monthly bookings for past 6 months (simple bar chart data)
  const monthlyData: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .gte("appointment_date", monthStart)
      .lte("appointment_date", monthEnd)
      .in("status", ["confirmed", "approved", "completed"]);

    monthlyData.push({
      month: d.toLocaleDateString("en-GB", { month: "short" }),
      count: count || 0,
    });
  }

  const maxMonthly = Math.max(...monthlyData.map((m) => m.count), 1);

  // Consultation type breakdown
  const { data: allBookings } = await supabase
    .from("bookings")
    .select("consultation_type")
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  const totalAll = allBookings?.length || 0;
  const videoCount =
    allBookings?.filter((b) => b.consultation_type === "video").length || 0;
  const inPersonCount = totalAll - videoCount;
  const videoPct = totalAll > 0 ? Math.round((videoCount / totalAll) * 100) : 0;
  const inPersonPct = totalAll > 0 ? 100 - videoPct : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Insights into your practice performance
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{doctor.total_bookings}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue This Month</p>
              <p className="text-2xl font-bold">
                {formatCurrency(thisMonthRevenue, currency)}
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
              <Eye className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profile Views</p>
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
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
          <div className="flex items-end gap-4 h-48">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-sm font-medium">{m.count}</span>
                <div className="w-full max-w-16 relative flex-1">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-md bg-primary/80 transition-all"
                    style={{
                      height: `${(m.count / maxMonthly) * 100}%`,
                      minHeight: m.count > 0 ? "8px" : "2px",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Booking Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {totalAll === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No bookings data yet
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">In Person</span>
                      <span className="text-sm text-muted-foreground">
                        {inPersonCount} ({inPersonPct}%)
                      </span>
                    </div>
                    <div className="mt-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${inPersonPct}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Video</span>
                      <span className="text-sm text-muted-foreground">
                        {videoCount} ({videoPct}%)
                      </span>
                    </div>
                    <div className="mt-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${videoPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Referral Sources (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>Top Referral Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { source: "Google Search", pct: 45, color: "bg-blue-500" },
                { source: "Direct Link", pct: 25, color: "bg-green-500" },
                { source: "Social Media", pct: 18, color: "bg-purple-500" },
                { source: "Doctor Referral", pct: 12, color: "bg-yellow-500" },
              ].map((ref) => (
                <div key={ref.source}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{ref.source}</span>
                    <span className="text-muted-foreground">{ref.pct}%</span>
                  </div>
                  <div className="mt-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${ref.color}`}
                      style={{ width: `${ref.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Placeholder data -- tracking coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
