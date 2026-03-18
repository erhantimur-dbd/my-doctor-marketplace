import { getOrgAnalytics } from "@/actions/org-dashboard";
import { requireOrgMember } from "@/actions/organization";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft, Calendar, DollarSign, Users, TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function OrgAnalyticsPage() {
  const { error } = await requireOrgMember(["owner", "admin"]);
  if (error) redirect("/en/doctor-dashboard");

  const analytics = await getOrgAnalytics();
  if (analytics.error) redirect("/en/doctor-dashboard/organization");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/doctor-dashboard/organization"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Organization Analytics</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{analytics.totalBookings}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold">{analytics.upcomingBookings}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-emerald-50 p-3">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Org Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(analytics.totalRevenue || 0, analytics.currency || "EUR")}
              </p>
              <p className="text-xs text-muted-foreground">Doctor payouts (excl. platform fee)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Doctors</p>
              <p className="text-2xl font-bold">
                {analytics.doctorBreakdown?.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Performance */}
      {analytics.doctorBreakdown && analytics.doctorBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bookings per Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.doctorBreakdown.map((doctor: any, i: number) => {
                const maxBookings = analytics.doctorBreakdown![0].bookings;
                const pct = maxBookings > 0 ? (doctor.bookings / maxBookings) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{doctor.name}</span>
                      <span className="text-muted-foreground">{doctor.bookings} bookings</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
