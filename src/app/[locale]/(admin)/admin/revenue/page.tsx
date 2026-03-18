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
import { Link } from "@/i18n/navigation";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { forecast, bookingVelocity } from "@/lib/utils/forecast";
import { DateRangeSelector } from "../components/date-range-selector";
import { ExportCSVButton } from "../components/export-csv-button";
import { exportRevenueCSV } from "@/actions/admin";

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const rangeDays = parseInt(range || "365") || 365;
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

  // --- Monthly chart (configurable range) ---
  const chartMonths = Math.min(Math.ceil(rangeDays / 30), 24);
  const monthlyData: { month: string; revenue: number; bookings: number }[] =
    [];
  for (let i = chartMonths - 1; i >= 0; i--) {
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

  // --- Revenue Forecast (next 3 months) ---
  const revenueValues = monthlyData.map((m) => m.revenue);
  const forecastResult = revenueValues.length >= 3 ? forecast(revenueValues, 3) : null;

  const forecastMonths: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    forecastMonths.push(
      d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
    );
  }

  // --- Booking Velocity ---
  const bookingCounts = monthlyData.map((m) => m.bookings);
  const velocity = bookingCounts.length >= 2 ? bookingVelocity(bookingCounts) : null;

  // --- Platform fees table ---
  const { data: fees } = await supabase
    .from("platform_fees")
    .select(
      `id, amount_cents, currency, fee_type, created_at, booking_id,
       booking:bookings(id, booking_number),
       doctor:doctors(id, profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(25);

  // Currency breakdown
  const currencyBreakdown: Record<string, { gmv: number; fees: number; count: number }> = {};
  (paidBookings || []).forEach((b: any) => {
    const cur = (b.currency || "EUR").toUpperCase();
    if (!currencyBreakdown[cur]) currencyBreakdown[cur] = { gmv: 0, fees: 0, count: 0 };
    currencyBreakdown[cur].gmv += b.total_amount_cents;
    currencyBreakdown[cur].fees += b.platform_fee_cents;
    currencyBreakdown[cur].count += 1;
  });
  const currencies = Object.entries(currencyBreakdown).sort((a, b) => b[1].fees - a[1].fees);

  // Take rate
  const takeRate =
    totalGMV > 0
      ? ((totalPlatformRevenue / totalGMV) * 100).toFixed(1)
      : "15.0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold">Revenue & Payments</h1>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector />
          <ExportCSVButton action={exportRevenueCSV} filename="revenue-export.csv" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
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
        </Link>
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
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
        </Link>
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
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
        </Link>
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
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
        </Link>
      </div>

      {/* GMV Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Total GMV</p>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(totalGMV, "EUR")}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/doctors" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Doctor Payouts
              </p>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(totalDoctorPayouts, "EUR")}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/bookings" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Total Bookings (Paid)
              </p>
              <p className="mt-1 text-xl font-bold">
                {paidBookings?.length || 0}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Currency Breakdown */}
      {currencies.length > 1 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(currencies.length, 4)}, minmax(0, 1fr))` }}>
          {currencies.map(([cur, data]) => (
            <Card key={cur}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-sm font-semibold">{cur}</Badge>
                  <span className="text-xs text-muted-foreground">{data.count} bookings</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GMV</span>
                    <span className="font-medium">{formatCurrency(data.gmv, cur)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fees</span>
                    <span className="font-medium text-green-600">{formatCurrency(data.fees, cur)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Platform Revenue (Last {chartMonths} Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart
            data={monthlyData.map((m) => ({ month: m.month, value: m.revenue }))}
            color="#22c55e"
            formatValue={(v) => formatCurrency(v, "EUR")}
            height={240}
          />
        </CardContent>
      </Card>

      {/* Revenue Forecast */}
      {forecastResult && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Revenue Forecast (Next 3 Months)
                <Badge variant={forecastResult.r2 > 0.7 ? "default" : "secondary"} className="ml-auto text-xs">
                  R² = {forecastResult.r2.toFixed(2)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {forecastResult.predicted.map((value, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{forecastMonths[i]}</span>
                    <span className="text-sm font-bold">
                      {formatCurrency(value, "EUR")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {forecastResult.trend === "up"
                  ? "📈 Revenue is trending upward"
                  : forecastResult.trend === "down"
                    ? "📉 Revenue is trending downward"
                    : "➡️ Revenue is stable"}
                {forecastResult.r2 < 0.5 && " (low confidence — limited data)"}
              </p>
            </CardContent>
          </Card>

          {velocity && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Booking Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold">{velocity.current}</p>
                  <p className="text-sm text-muted-foreground">bookings/month (avg last 4)</p>
                  <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                    velocity.trend === "up"
                      ? "bg-green-100 text-green-700"
                      : velocity.trend === "down"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                  }`}>
                    {velocity.trend === "up" ? "↑" : velocity.trend === "down" ? "↓" : "→"}
                    {velocity.changePercent > 0 ? "+" : ""}{velocity.changePercent}% vs previous period
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
              {fees?.map((fee: any) => {
                const bookingId = fee.booking?.id || fee.booking_id;
                const row = (
                  <TableRow key={fee.id} className={bookingId ? "cursor-pointer hover:bg-muted/50" : ""}>
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
                );
                return bookingId ? (
                  <Link key={fee.id} href={`/admin/bookings/${bookingId}`} className="contents">
                    {row}
                  </Link>
                ) : row;
              })}
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
