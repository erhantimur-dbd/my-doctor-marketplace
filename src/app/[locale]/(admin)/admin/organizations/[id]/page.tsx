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
import { ArrowLeft, Building2, Gift } from "lucide-react";
import { CreateLicenseDialog } from "./create-license-dialog";

const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "secondary",
  grace_period: "destructive",
  suspended: "destructive",
  cancelled: "destructive",
};

export default async function AdminOrganizationDetailPage({
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

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) redirect("/en/admin/organizations");

  // Fetch license (most recent non-cancelled, or latest overall)
  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch members
  const { data: members } = await supabase
    .from("organization_members")
    .select(
      "id, role, status, created_at, user:profiles(first_name, last_name, email)"
    )
    .eq("organization_id", id)
    .order("role");

  // Fetch doctors in this org
  const { data: doctors } = await supabase
    .from("doctors")
    .select(
      "id, specialty, verification_status, is_active, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
    )
    .eq("organization_id", id);

  const hasActiveLicense =
    license && !["cancelled"].includes(license.status);
  const isPromotional = license?.metadata?.is_promotional === true;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Organizations
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">{org.name}</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            {org.slug} &middot; {org.email || "No email"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {license ? (
            <>
              <Badge variant={statusColor[license.status] || "outline"}>
                {license.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {license.tier}
              </Badge>
              {isPromotional && (
                <Badge className="bg-purple-100 text-purple-800">
                  <Gift className="mr-1 h-3 w-3" />
                  Promo
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              No License
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{org.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-sm">{org.slug}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{org.email || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{org.phone || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Website</span>
              <span>{org.website || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="max-w-[200px] text-right text-sm">
                {[org.address_line1, org.city, org.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone</span>
              <span>{org.timezone || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span>{org.base_currency || "EUR"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe Customer</span>
              <span className="font-mono text-xs">
                {org.stripe_customer_id || "—"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(org.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* License Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>License</CardTitle>
            </CardHeader>
            <CardContent>
              {license ? (
                <div className="space-y-3">
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
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period End</span>
                    <span>
                      {new Date(license.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                  {isPromotional && license.metadata?.promo_note && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Promo Note</span>
                        <span className="max-w-[180px] text-right text-sm">
                          {String(license.metadata.promo_note)}
                        </span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <Link
                    href={`/admin/licenses/${license.id}`}
                    className="inline-block text-sm font-medium text-primary hover:underline"
                  >
                    View Full License Details &rarr;
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This organization has no active license.
                  </p>
                  <CreateLicenseDialog organizationId={org.id} orgName={org.name} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick action to create license even if cancelled */}
          {license && license.status === "cancelled" && (
            <Card>
              <CardContent className="p-6">
                <p className="mb-3 text-sm text-muted-foreground">
                  Previous license was cancelled. Create a new one?
                </p>
                <CreateLicenseDialog organizationId={org.id} orgName={org.name} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
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
                    <TableCell>
                      <Badge
                        variant={m.status === "active" ? "default" : "destructive"}
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!members || members.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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

      {/* Doctors */}
      <Card>
        <CardHeader>
          <CardTitle>Doctors ({doctors?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors?.map((d: any) => {
                const profile: any = Array.isArray(d.profile)
                  ? d.profile[0]
                  : d.profile;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link
                        href={`/admin/doctors/${d.id}`}
                        className="font-medium hover:underline"
                      >
                        {profile?.first_name} {profile?.last_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.specialty || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.verification_status === "verified"
                            ? "default"
                            : "outline"
                        }
                      >
                        {d.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!doctors || doctors.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No doctors
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
