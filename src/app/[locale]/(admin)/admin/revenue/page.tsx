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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  BarChart3,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function AdminRevenuePage() {
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  // --- All-time metrics from bookings ---
  const { data: paidBookings } = await supabase
    .from("bookings")
    .select("total_amount_cents, platform_fee_cents, currency")
    .in("status", ["confirmed", "approved", "completed"]);

  const totalGMV = (paidBookings || []).reduce(
    (sum, b: any) => sum + b.total_amount_cents,
    0
  );
  const totalPlatformRevenue = (paidBookings || []).reduce(
    (sum, b: any) => sum + b.platform_fee_cents,
    0
  );
  const totalDoctorPayouts = totalGMV - totalPlatformRevenue;
  const avgFeePerBooking =
    paidBookings && paidBookings.length > 0
      ? Math.round(totalPlatformRevenue / paidBookings.length)
      : 0;

  // --- This month revenue ---
  const { data: monthBookings } = await supabase
    .from("bookings")
    .select("platform_fee_cents")
    .gte("appointment_date", startOfMonth)
    .in("status", ["confirmed", "approved", "completed"]);

  const thisMonthRevenue = (monthBookings || []).reduce(
    (sum, b: any) => sum + b.platform_fee_cents,
    0
  );

  // --- Monthly chart (last 12 months) ---
  const monthlyData: { month: string; revenue: number; bookings: number }[] =
    [];
  for (let i = 11; i >= 0; i--) {
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
      month: d.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
      }),
      revenue: (mBookings || []).reduce(
        (sum, b: any) => sum + b.platform_fee_cents,
        0
      ),
      bookings: mBookings?.length || 0,
    });
  }

  const maxRevenue = Math.max(...monthlyData.map((m) => m.revenue), 1);

  // --- Platform fees table ---
  const { data: fees } = await supabase
    .from("platform_fees")
    .select(
      `id, amount_cents, currency, fee_type, created_at,
       booking:bookings(booking_number),
       doctor:doctors(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(25);

  // Take rate
  const takeRate =
    totalGMV > 0
      ? ((totalPlatformRevenue / totalGMV) * 100).toFixed(1)
      : "15.0";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold">Revenue & Payments</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Platform Revenue (All Time)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalPlatformRevenue, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {formatCurrency(thisMonthRevenue, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Take Rate</p>
              <p className="text-2xl font-bold">{takeRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-50 p-3">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Avg Fee / Booking
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(avgFeePerBooking, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GMV Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Total GMV</p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(totalGMV, "EUR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Doctor Payouts
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(totalDoctorPayouts, "EUR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Total Bookings (Paid)
            </p>
            <p className="mt-1 text-xl font-bold">
              {paidBookings?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Platform Revenue (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-2">
            {monthlyData.map((m) => (
              <div
                key={m.month}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] font-medium">
                  {m.revenue > 0 ? formatCurrency(m.revenue, "EUR") : ""}
                </span>
                <div className="relative w-full max-w-12 flex-1">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-md bg-green-500/80 transition-all"
                    style={{
                      height: `${(m.revenue / maxRevenue) * 100}%`,
                      minHeight: m.revenue > 0 ? "6px" : "2px",
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Platform Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Platform Fees</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees?.map((fee: any) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-mono text-xs">
                    {fee.booking?.booking_number || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {fee.doctor
                      ? `Dr. ${fee.doctor.profile?.first_name} ${fee.doctor.profile?.last_name}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {fee.fee_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(fee.amount_cents, fee.currency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(fee.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {(!fees || fees.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No platform fees recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
