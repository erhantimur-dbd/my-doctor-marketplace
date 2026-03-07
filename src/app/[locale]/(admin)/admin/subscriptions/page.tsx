import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crown, Users, TrendingUp, DollarSign, BarChart3, UserMinus } from "lucide-react";

// Plan prices in cents per month (EUR)
const PLAN_PRICES: Record<string, number> = {
  basic: 4900,
  professional: 9900,
  premium: 19900,
};

export default async function AdminSubscriptionsPage() {
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

  const { data: subscriptions } = await supabase
    .from("doctor_subscriptions")
    .select(
      `id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at,
       doctor:doctors(profile:profiles!doctors_profile_id_fkey(first_name, last_name, email))`
    )
    .order("created_at", { ascending: false });

  const planCounts: Record<string, number> = {};
  let activeCount = 0;
  let mrrCents = 0;
  let cancellingCount = 0;
  subscriptions?.forEach(
    (sub: any) => {
      if (sub.status === "active" || sub.status === "trialing") {
        planCounts[sub.plan_id] = (planCounts[sub.plan_id] || 0) + 1;
        activeCount++;
        mrrCents += PLAN_PRICES[sub.plan_id] || 0;
        if (sub.cancel_at_period_end) cancellingCount++;
      }
    }
  );

  const arrCents = mrrCents * 12;

  // Churn: subscriptions cancelled in last 30 days / active at start of period
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentlyCancelled = (subscriptions || []).filter(
    (sub: any) =>
      sub.status === "cancelled" &&
      sub.current_period_end &&
      new Date(sub.current_period_end) >= thirtyDaysAgo
  ).length;
  const churnBase = activeCount + recentlyCancelled;
  const churnRate = churnBase > 0 ? ((recentlyCancelled / churnBase) * 100).toFixed(1) : "0.0";

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    past_due: "secondary",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Subscription Management</h1>
      </div>

      {/* MRR/ARR KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-2xl font-bold">€{(mrrCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">monthly recurring</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ARR</p>
              <p className="text-2xl font-bold">€{(arrCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">annual recurring</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Subscribers</p>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">{cancellingCount > 0 ? `${cancellingCount} cancelling` : "all renewing"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-red-50 p-3">
              <UserMinus className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Churn Rate (30d)</p>
              <p className="text-2xl font-bold">{churnRate}%</p>
              <p className="text-xs text-muted-foreground">{recentlyCancelled} cancelled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {["basic", "professional", "premium"].map((plan) => (
          <Card key={plan}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-purple-50 p-3">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm capitalize text-muted-foreground">
                  {plan} Plan
                </p>
                <p className="text-2xl font-bold">
                  {planCounts[plan] || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  active · €{((PLAN_PRICES[plan] || 0) / 100).toFixed(0)}/mo
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Auto-Renew</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions?.map(
                (sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.doctor.profile.first_name}{" "}
                      {sub.doctor.profile.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.doctor.profile.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {sub.plan_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor[sub.status] || "outline"}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(sub.current_period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {sub.cancel_at_period_end ? (
                        <Badge variant="destructive">Cancelling</Badge>
                      ) : (
                        <Badge variant="default">Yes</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!subscriptions || subscriptions.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No subscriptions yet
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
