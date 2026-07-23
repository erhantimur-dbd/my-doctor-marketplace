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
  ThumbsUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { Link } from "@/i18n/navigation";
import {
  aggregateNpsMetrics,
  sortRecentSurveyResponses,
} from "@/lib/analytics/nps";
import { Button } from "@/components/ui/button";

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

  // NPS / satisfaction surveys (submitted only)
  const { data: surveyRows } = await supabase
    .from("satisfaction_surveys")
    .select(
      "id, nps_score, would_recommend, feedback_text, submitted_at, token"
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(100);

  const nps = aggregateNpsMetrics(surveyRows || []);
  const recentSurveys = sortRecentSurveyResponses(surveyRows || [], 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Platform Analytics</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/nps">NPS deep dive</Link>
        </Button>
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

      {/* NPS breakdown + recent responses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-primary" />
            Patient NPS
          </CardTitle>
          <Button variant="link" size="sm" className="px-0" asChild>
            <Link href="/admin/nps">View all responses</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">NPS score</p>
              <p
                className={`text-3xl font-bold ${
                  nps.npsScore == null
                    ? ""
                    : nps.npsScore >= 50
                      ? "text-green-600"
                      : nps.npsScore >= 0
                        ? "text-amber-600"
                        : "text-red-600"
                }`}
              >
                {nps.npsScore ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {nps.responseCount} responses
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Promoters (9–10)</p>
              <p className="text-2xl font-bold text-green-600">
                {nps.promoters}
              </p>
              <p className="text-xs text-muted-foreground">{nps.promoterRate}%</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Passives (7–8)</p>
              <p className="text-2xl font-bold text-amber-600">{nps.passives}</p>
              <p className="text-xs text-muted-foreground">{nps.passiveRate}%</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Detractors (0–6)</p>
              <p className="text-2xl font-bold text-red-600">{nps.detractors}</p>
              <p className="text-xs text-muted-foreground">{nps.detractorRate}%</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Recent feedback</h3>
            {recentSurveys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No submitted surveys yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium">Recommend</th>
                      <th className="px-3 py-2 font-medium">Feedback</th>
                      <th className="px-3 py-2 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSurveys.map((row) => (
                      <tr key={row.id || row.token || row.submitted_at} className="border-t">
                        <td className="px-3 py-2 font-semibold">
                          {row.nps_score}
                        </td>
                        <td className="px-3 py-2">
                          {row.would_recommend === true
                            ? "Yes"
                            : row.would_recommend === false
                              ? "No"
                              : "—"}
                        </td>
                        <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">
                          {row.feedback_text || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {row.submitted_at
                            ? new Date(row.submitted_at).toLocaleDateString(
                                "en-GB"
                              )
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
