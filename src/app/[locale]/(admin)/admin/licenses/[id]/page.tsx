import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Crown, AlertTriangle, Gift } from "lucide-react";
import { LicenseActionsClient } from "./license-actions-client";

const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "secondary",
  grace_period: "destructive",
  suspended: "destructive",
  cancelled: "destructive",
};

export default async function AdminLicenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (adminProfile?.role !== "admin") redirect("/en");

  const { data: license } = await supabase
    .from("licenses")
    .select(
      `*, organization:organizations(id, name, slug, email, stripe_customer_id)`
    )
    .eq("id", id)
    .single();

  if (!license) redirect("/en/admin/licenses");

  const org: any = Array.isArray(license.organization)
    ? license.organization[0]
    : license.organization;

  // Fetch org members
  const { data: members } = await supabase
    .from("organization_members")
    .select(
      "id, role, status, user:profiles(first_name, last_name, email)"
    )
    .eq("organization_id", org?.id || "")
    .eq("status", "active")
    .order("role");

  // Fetch license modules
  const { data: modules } = await supabase
    .from("license_modules")
    .select("*")
    .eq("license_id", id);

  // Fetch recent audit log
  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("action, created_at, metadata, actor:profiles!audit_log_actor_id_fkey(first_name, last_name)")
    .eq("target_type", "license")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const isPromotional = license.metadata?.is_promotional === true;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/licenses"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Licenses
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold">
              {org?.name || "Unknown"} License
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            <Link
              href={`/admin/organizations/${org?.id}`}
              className="hover:underline"
            >
              {org?.slug}
            </Link>{" "}
            &middot; {org?.email || "No email"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusColor[license.status] || "outline"}>
            {license.status}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {license.tier}
          </Badge>
          {isPromotional && (
            <Badge className="bg-purple-100 text-purple-800">
              <Gift className="mr-1 h-3 w-3" />
              Promotional
            </Badge>
          )}
        </div>
      </div>

      {license.stripe_subscription_id && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          This license has a Stripe subscription ({license.stripe_subscription_id}).
          Manual status changes won&apos;t sync to Stripe.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* License Info */}
        <Card>
          <CardHeader>
            <CardTitle>License Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tier</span>
              <span className="font-medium capitalize">{license.tier}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusColor[license.status] || "outline"}>
                {license.status}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seats</span>
              <span>
                {license.used_seats}/{license.max_seats}
                {license.extra_seat_count > 0 &&
                  ` (+${license.extra_seat_count} extra)`}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period</span>
              <span>
                {new Date(license.current_period_start).toLocaleDateString()} –{" "}
                {new Date(license.current_period_end).toLocaleDateString()}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-Renew</span>
              <span>{license.cancel_at_period_end ? "No (cancelling)" : "Yes"}</span>
            </div>
            {license.trial_ends_at && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial Ends</span>
                  <span>{new Date(license.trial_ends_at).toLocaleDateString()}</span>
                </div>
              </>
            )}
            {license.grace_period_start && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grace Period Start</span>
                  <span>{new Date(license.grace_period_start).toLocaleDateString()}</span>
                </div>
              </>
            )}
            {license.suspended_at && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suspended At</span>
                  <span>{new Date(license.suspended_at).toLocaleDateString()}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe Sub</span>
              <span className="font-mono text-xs">
                {license.stripe_subscription_id || "—"}
              </span>
            </div>
            {isPromotional && license.metadata?.promo_note && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Promo Note</span>
                  <span className="max-w-[200px] text-right text-sm">
                    {String(license.metadata.promo_note)}
                  </span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(license.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <LicenseActionsClient
              licenseId={license.id}
              currentStatus={license.status}
              currentTier={license.tier}
              maxSeats={license.max_seats}
              extraSeatCount={license.extra_seat_count}
              usedSeats={license.used_seats}
              currentPeriodEnd={license.current_period_end}
            />
          </CardContent>
        </Card>
      </div>

      {/* Active Modules */}
      {modules && modules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod: any) => (
                  <TableRow key={mod.id}>
                    <TableCell className="font-medium capitalize">
                      {mod.module_key.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mod.is_active ? "default" : "outline"}>
                        {mod.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(mod.activated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Members ({members?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((m: any) => {
                const profile: any = Array.isArray(m.user)
                  ? m.user[0]
                  : m.user;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {profile?.first_name} {profile?.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile?.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {m.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!members || members.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No members
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLog?.map((entry: any, i: number) => {
                const actor: any = Array.isArray(entry.actor)
                  ? entry.actor[0]
                  : entry.actor;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {entry.action.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {actor?.first_name} {actor?.last_name}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {entry.metadata?.reason ||
                        entry.metadata?.from
                          ? `${entry.metadata.from} → ${entry.metadata.to}`
                          : ""}
                    </TableCell>
                    <TableCell>
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!auditLog || auditLog.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No audit entries
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
