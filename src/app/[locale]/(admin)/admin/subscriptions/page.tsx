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
import { LICENSE_TIERS } from "@/lib/constants/license-tiers";

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

  // Fetch all licenses with org info
  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      `id, tier, status, current_period_start, current_period_end, cancel_at_period_end, metadata, created_at,
       organization:organizations(name)`
    )
    .order("created_at", { ascending: false });

  // Build a map of org_id → first owner member name/email
  const orgIds = [...new Set((licenses || []).map((l: any) => l.organization_id).filter(Boolean))];
  let ownerMap = new Map<string, { name: string; email: string }>();
  if (orgIds.length > 0) {
    // Get owners for each org via organization_members + profiles
    const { data: owners } = await supabase
      .from("organization_members")
      .select("organization_id, user:profiles!organization_members_user_id_fkey(first_name, last_name, email)")
      .eq("role", "owner")
      .eq("status", "active");
    (owners || []).forEach((o: any) => {
      const u = Array.isArray(o.user) ? o.user[0] : o.user;
      if (u && o.organization_id) {
        ownerMap.set(o.organization_id, {
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
          email: u.email || "",
        });
      }
    });
  }

  // Build tier price lookup from LICENSE_TIERS
  const tierPriceMap = new Map<string, number>();
  LICENSE_TIERS.forEach((t) => {
    tierPriceMap.set(t.id, t.priceMonthlyPence);
  });

  const tierCounts: Record<string, number> = {};
  let activeCount = 0;
  let mrrCents = 0;
  let cancellingCount = 0;
  (licenses || []).forEach((lic: any) => {
    if (["active", "trialing", "past_due"].includes(lic.status)) {
      tierCounts[lic.tier] = (tierCounts[lic.tier] || 0) + 1;
      activeCount++;
      mrrCents += tierPriceMap.get(lic.tier) || 0;
      if (lic.cancel_at_period_end) cancellingCount++;
    }
  });

  const arrCents = mrrCents * 12;

  // Churn: cancelled in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentlyCancelled = (licenses || []).filter(
    (lic: any) =>
      lic.status === "cancelled" &&
      lic.current_period_end &&
      new Date(lic.current_period_end) >= thirtyDaysAgo
  ).length;
  const churnBase = activeCount + recentlyCancelled;
  const churnRate = churnBase > 0 ? ((recentlyCancelled / churnBase) * 100).toFixed(1) : "0.0";

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    trialing: "secondary",
    past_due: "secondary",
    cancelled: "destructive",
    grace_period: "destructive",
    suspended: "destructive",
  };

  // Display tiers for the plan breakdown cards
  const displayTierIds = ["starter", "professional", "clinic"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">License Management</h1>
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
              <p className="text-2xl font-bold">
                £{(mrrCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
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
                £{(arrCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
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
                {cancellingCount > 0 ? `${cancellingCount} cancelling` : "all renewing"}
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
              <p className="text-sm text-muted-foreground">Churn Rate (30d)</p>
              <p className="text-2xl font-bold">{churnRate}%</p>
              <p className="text-xs text-muted-foreground">{recentlyCancelled} cancelled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {displayTierIds.map((tierId) => {
          const tier = LICENSE_TIERS.find((t) => t.id === tierId);
          return (
            <Card key={tierId}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-full bg-purple-50 p-3">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm capitalize text-muted-foreground">
                    {tier?.name || tierId}
                  </p>
                  <p className="text-2xl font-bold">{tierCounts[tierId] || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    active · £{((tierPriceMap.get(tierId) || 0) / 100).toFixed(0)}/mo
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Licenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Auto-Renew</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(licenses || []).map((lic: any) => {
                const org: any = Array.isArray(lic.organization) ? lic.organization[0] : lic.organization;
                const owner = ownerMap.get(lic.organization_id);
                return (
                  <TableRow key={lic.id}>
                    <TableCell className="font-medium">
                      {org?.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {owner ? `${owner.name} (${owner.email})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          lic.tier === "professional"
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : lic.tier === "starter"
                              ? "border-teal-300 bg-teal-50 text-teal-700"
                              : lic.tier === "clinic"
                                ? "border-purple-300 bg-purple-50 text-purple-700"
                                : ""
                        }
                      >
                        {lic.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor[lic.status] || "outline"}>
                        {lic.status}
                      </Badge>
                      {lic.metadata?.is_promotional && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          Promo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {lic.current_period_end
                        ? new Date(lic.current_period_end).toLocaleDateString()
                        : "—"}
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
