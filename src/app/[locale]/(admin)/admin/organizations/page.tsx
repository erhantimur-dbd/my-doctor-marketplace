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
import { Building2, Users, Crown } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function AdminOrganizationsPage() {
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

  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  // Get member counts per org
  const orgIds = (organizations || []).map((o: any) => o.id);
  let memberCounts: Record<string, number> = {};
  let licenseTiers: Record<string, string> = {};
  let licenseStatuses: Record<string, string> = {};

  if (orgIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("organization_id")
      .in("organization_id", orgIds)
      .eq("status", "active");

    if (members) {
      for (const m of members) {
        memberCounts[m.organization_id] =
          (memberCounts[m.organization_id] || 0) + 1;
      }
    }

    const { data: licenses } = await supabase
      .from("licenses")
      .select("organization_id, tier, status")
      .in("organization_id", orgIds)
      .in("status", ["active", "trialing", "past_due", "grace_period", "suspended"]);

    if (licenses) {
      for (const l of licenses) {
        licenseTiers[l.organization_id] = l.tier;
        licenseStatuses[l.organization_id] = l.status;
      }
    }
  }

  const totalOrgs = organizations?.length || 0;
  const withLicense = Object.keys(licenseTiers).length;

  const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    trialing: "secondary",
    past_due: "secondary",
    grace_period: "destructive",
    suspended: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Organizations</h1>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Organizations</p>
              <p className="text-2xl font-bold">{totalOrgs}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <Crown className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">With Active License</p>
              <p className="text-2xl font-bold">{withLicense}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Without License</p>
              <p className="text-2xl font-bold">{totalOrgs - withLicense}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org: any) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div>
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="font-medium hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{org.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {org.email || "—"}
                  </TableCell>
                  <TableCell>{memberCounts[org.id] || 0}</TableCell>
                  <TableCell>
                    {licenseTiers[org.id] ? (
                      <Badge variant="outline" className="capitalize">
                        {licenseTiers[org.id]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {licenseStatuses[org.id] ? (
                      <Badge
                        variant={statusColor[licenseStatuses[org.id]] || "outline"}
                      >
                        {licenseStatuses[org.id]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(org.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {(!organizations || organizations.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No organizations yet
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
