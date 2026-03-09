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
import { Crown, Users, TrendingUp, DollarSign, UserMinus, BarChart3 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LICENSE_TIERS } from "@/lib/constants/license-tiers";
import { formatCurrency } from "@/lib/utils/currency";

export default async function AdminLicensesPage() {
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

  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      `id, tier, status, max_seats, used_seats, extra_seat_count,
       current_period_start, current_period_end, cancel_at_period_end, created_at,
       organization:organizations(name, email, slug)`
    )
    .order("created_at", { ascending: false });

  // Compute KPIs
  const tierCounts: Record<string, number> = {};
  let activeCount = 0;
  let mrrCents = 0;
  let totalSeats = 0;

  licenses?.forEach((lic: any) => {
    if (lic.status === "active" || lic.status === "trialing") {
      const tierKey = lic.tier;
      tierCounts[tierKey] = (tierCounts[tierKey] || 0) + 1;
      activeCount++;
      const tierConfig = LICENSE_TIERS.find((t) => t.id === tierKey);
      if (tierConfig) {
        mrrCents += tierConfig.priceMonthly;
        mrrCents += lic.extra_seat_count * 2900; // extra seat price
      }
      totalSeats += lic.used_seats;
    }
  });

  const arrCents = mrrCents * 12;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentlyCancelled = (licenses || []).filter(
    (lic: any) =>
      lic.status === "cancelled" &&
      lic.current_period_end &&
      new Date(lic.current_period_end) >= thirtyDaysAgo
  ).length;
  const churnBase = activeCount + recentlyCancelled;
  const churnRate =
    churnBase > 0
      ? ((recentlyCancelled / churnBase) * 100).toFixed(1)
      : "0.0";

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    trialing: "secondary",
    past_due: "secondary",
    grace_period: "destructive",
    suspended: "destructive",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">License Management</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-2xl font-bold">
                {formatCurrency(mrrCents, "EUR")}
              </p>
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
              <p className="text-2xl font-bold">
                {formatCurrency(arrCents, "EUR")}
              </p>
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
              <p className="text-sm text-muted-foreground">Active Licenses</p>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">
                {totalSeats} total seats
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-red-50 p-3">
              <UserMinus className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Churn (30d)</p>
              <p className="text-2xl font-bold">{churnRate}%</p>
              <p className="text-xs text-muted-foreground">
                {recentlyCancelled} cancelled
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <div className="grid gap-4 sm:grid-cols-4">
        {LICENSE_TIERS.map((tier) => (
          <Card key={tier.id}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-purple-50 p-3">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm capitalize text-muted-foreground">
                  {tier.name}
                </p>
                <p className="text-2xl font-bold">{tierCounts[tier.id] || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {tier.isCustomPricing
                    ? "custom pricing"
                    : `${formatCurrency(tier.priceMonthly, "EUR")}/mo`}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Licenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Licenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Auto-Renew</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses?.map((lic: any) => {
                const org = Array.isArray(lic.organization)
                  ? lic.organization[0]
                  : lic.organization;
                return (
                  <TableRow key={lic.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/admin/licenses/${lic.id}`}
                          className="font-medium hover:underline"
                        >
                          {org?.name || "—"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {org?.email || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {lic.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor[lic.status] || "outline"}>
                        {lic.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lic.used_seats}/{lic.max_seats}
                    </TableCell>
                    <TableCell>
                      {new Date(lic.current_period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {lic.cancel_at_period_end ? (
                        <Badge variant="destructive">Cancelling</Badge>
                      ) : (
                        <Badge variant="default">Yes</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!licenses || licenses.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No licenses yet
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
