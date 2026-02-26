import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Users,
  Calendar,
  DollarSign,
  Star,
  ShieldAlert,
  Crown,
  TrendingUp,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/en");

  // --- KPI Queries (run in parallel) ---
  const [
    { count: totalDoctors },
    { count: totalPatients },
    { count: totalBookings },
    { data: revenueBookings },
    { count: pendingReviews },
    { count: pendingVerifications },
    { count: activeSubscriptions },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from("doctors").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "patient"),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("platform_fee_cents")
      .in("status", ["confirmed", "approved", "completed"]),
    supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("is_visible", false),
    supabase
      .from("doctors")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("doctor_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("bookings")
      .select(
        "id, booking_number, appointment_date, start_time, status, consultation_type, total_amount_cents, currency, patient_id, doctor_id"
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const totalRevenue = (revenueBookings || []).reduce(
    (sum, b) => sum + ((b as any).platform_fee_cents || 0),
    0
  );

  // Get patient + doctor names for recent bookings
  type BookingWithNames = {
    id: string;
    booking_number: string;
    appointment_date: string;
    start_time: string;
    status: string;
    consultation_type: string;
    total_amount_cents: number;
    currency: string;
    patientName: string;
    doctorName: string;
  };

  let recentBookingsWithNames: BookingWithNames[] = [];

  if (recentBookings && recentBookings.length > 0) {
    const patientIds = [
      ...new Set(recentBookings.map((b: any) => b.patient_id)),
    ];
    const doctorIds = [
      ...new Set(recentBookings.map((b: any) => b.doctor_id)),
    ];

    const [{ data: patients }, { data: doctorProfiles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", patientIds),
      supabase
        .from("doctors")
        .select(
          "id, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
        )
        .in("id", doctorIds),
    ]);

    const patientMap = new Map(
      (patients || []).map((p: any) => [
        p.id,
        `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
      ])
    );

    const doctorMap = new Map(
      (doctorProfiles || []).map((d: any) => {
        const prof = Array.isArray(d.profile) ? d.profile[0] : d.profile;
        return [
          d.id,
          `${prof?.first_name || ""} ${prof?.last_name || ""}`.trim() ||
            "Unknown",
        ];
      })
    );

    recentBookingsWithNames = recentBookings.map((b: any) => ({
      id: b.id,
      booking_number: b.booking_number,
      appointment_date: b.appointment_date,
      start_time: b.start_time,
      status: b.status,
      consultation_type: b.consultation_type,
      total_amount_cents: b.total_amount_cents,
      currency: b.currency,
      patientName: patientMap.get(b.patient_id) || "Unknown",
      doctorName: doctorMap.get(b.doctor_id) || "Unknown",
    }));
  }

  // --- Monthly Revenue Chart (last 6 months) ---
  const monthlyData: { month: string; revenue: number }[] = [];
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
      .select("platform_fee_cents")
      .gte("appointment_date", mStart)
      .lte("appointment_date", mEnd)
      .in("status", ["confirmed", "approved", "completed"]);

    monthlyData.push({
      month: d.toLocaleDateString("en-GB", { month: "short" }),
      revenue: (mBookings || []).reduce(
        (sum, b) => sum + ((b as any).platform_fee_cents || 0),
        0
      ),
    });
  }

  const maxRevenue = Math.max(...monthlyData.map((m) => m.revenue), 1);

  const statusColors: Record<string, string> = {
    pending_payment: "bg-gray-100 text-gray-700",
    confirmed: "bg-blue-100 text-blue-700",
    approved: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled_patient: "bg-red-100 text-red-700",
    cancelled_doctor: "bg-red-100 text-red-700",
    no_show: "bg-yellow-100 text-yellow-700",
    refunded: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.first_name}. Here&apos;s your platform
          overview.
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Stethoscope className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Doctors</p>
              <p className="text-2xl font-bold">{totalDoctors || 0}</p>
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
              <p className="text-2xl font-bold">{totalPatients || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-50 p-3">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{totalBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Platform Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalRevenue, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats - Action Items */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Reviews</p>
              <p className="text-2xl font-bold">{pendingReviews || 0}</p>
              <p className="text-xs text-muted-foreground">
                Awaiting moderation
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-orange-50 p-3">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Pending Verifications
              </p>
              <p className="text-2xl font-bold">
                {pendingVerifications || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Doctors awaiting review
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-teal-50 p-3">
              <Crown className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Active Subscriptions
              </p>
              <p className="text-2xl font-bold">
                {activeSubscriptions || 0}
              </p>
              <p className="text-xs text-muted-foreground">Recurring revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Revenue (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-4">
            {monthlyData.map((m) => (
              <div
                key={m.month}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-xs font-medium">
                  {formatCurrency(m.revenue, "EUR")}
                </span>
                <div className="relative w-full max-w-16 flex-1">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-md bg-green-500/80 transition-all"
                    style={{
                      height: `${(m.revenue / maxRevenue) * 100}%`,
                      minHeight: m.revenue > 0 ? "8px" : "2px",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookingsWithNames.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No bookings yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentBookingsWithNames.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {booking.patientName}
                      </p>
                      <span className="text-xs text-muted-foreground">→</span>
                      <p className="truncate text-sm text-muted-foreground">
                        Dr. {booking.doctorName}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {booking.booking_number} ·{" "}
                      {new Date(booking.appointment_date).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatCurrency(
                        booking.total_amount_cents,
                        booking.currency
                      )}
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        statusColors[booking.status] ||
                        "bg-gray-100 text-gray-700"
                      }
                    >
                      {booking.status.replace(/_/g, " ")}
                    </Badge>
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
