import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  Stethoscope,
  Calendar,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // Current month bookings
  const { count: monthBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth)
    .in("status", ["confirmed", "approved", "completed"]);

  // Last month bookings
  const { count: lastMonthBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfLastMonth)
    .lte("created_at", endOfLastMonth)
    .in("status", ["confirmed", "approved", "completed"]);

  // Total revenue (platform fees)
  const { data: fees } = await supabase
    .from("platform_fees")
    .select("amount_cents")
    .gte("created_at", startOfMonth);

  const monthlyRevenue = fees?.reduce(
    (sum: number, f: { amount_cents: number }) => sum + f.amount_cents,
    0
  ) || 0;

  // New users this month
  const { count: newPatients } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "patient")
    .gte("created_at", startOfMonth);

  const { count: newDoctors } = await supabase
    .from("doctors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth);

  // Booking type breakdown
  const { count: videoBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("consultation_type", "video")
    .gte("created_at", startOfMonth);

  const { count: inPersonBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("consultation_type", "in_person")
    .gte("created_at", startOfMonth);

  const totalTypeBookings = (videoBookings || 0) + (inPersonBookings || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Platform Revenue (This Month)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(monthlyRevenue, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Bookings This Month
              </p>
              <p className="text-2xl font-bold">{monthBookings || 0}</p>
              {lastMonthBookings ? (
                <p className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  vs {lastMonthBookings} last month
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                New Patients (This Month)
              </p>
              <p className="text-2xl font-bold">{newPatients || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Stethoscope className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                New Doctors (This Month)
              </p>
              <p className="text-2xl font-bold">{newDoctors || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consultation Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>In-Person</span>
                <span className="font-medium">
                  {inPersonBookings || 0}{" "}
                  ({totalTypeBookings > 0
                    ? Math.round(((inPersonBookings || 0) / totalTypeBookings) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${
                      totalTypeBookings > 0
                        ? ((inPersonBookings || 0) / totalTypeBookings) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Video</span>
                <span className="font-medium">
                  {videoBookings || 0}{" "}
                  ({totalTypeBookings > 0
                    ? Math.round(((videoBookings || 0) / totalTypeBookings) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{
                    width: `${
                      totalTypeBookings > 0
                        ? ((videoBookings || 0) / totalTypeBookings) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">
                  Booking Growth
                </span>
                <span className="font-medium">
                  {lastMonthBookings && lastMonthBookings > 0
                    ? `${Math.round(
                        (((monthBookings || 0) - lastMonthBookings) / lastMonthBookings) * 100
                      )}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">
                  Avg Revenue per Booking
                </span>
                <span className="font-medium">
                  {monthBookings && monthBookings > 0
                    ? formatCurrency(
                        Math.round(monthlyRevenue / monthBookings),
                        "EUR"
                      )
                    : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
