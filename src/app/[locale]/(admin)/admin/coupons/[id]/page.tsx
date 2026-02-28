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
import { ArrowLeft, Tag } from "lucide-react";
import { CouponActionsClient } from "./coupon-actions-client";

function formatDiscount(type: string, value: number, currency: string) {
  if (type === "percentage") return `${value}%`;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value / 100);
}

export default async function AdminCouponDetailPage({
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

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", id)
    .single();

  if (!coupon) redirect("/en/admin/coupons");

  // Fetch redemptions with doctor info
  const { data: redemptions } = await supabase
    .from("coupon_redemptions")
    .select(
      "*, doctor:doctors!coupon_redemptions_doctor_id_fkey(profile:profiles!doctors_profile_id_fkey(first_name, last_name, email))"
    )
    .eq("coupon_id", id)
    .order("redeemed_at", { ascending: false });

  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
  const usesRemaining = coupon.max_uses ? coupon.max_uses - coupon.current_uses : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/coupons"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Coupons
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="font-mono text-2xl font-bold">{coupon.code}</h1>
          </div>
          <p className="mt-1 text-muted-foreground">{coupon.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {coupon.is_active ? (
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inactive
            </Badge>
          )}
          {isExpired && <Badge variant="destructive">Expired</Badge>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Coupon Info */}
        <Card>
          <CardHeader>
            <CardTitle>Coupon Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coupon.description && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span>{coupon.description}</span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <Badge variant="secondary">
                {formatDiscount(coupon.discount_type, coupon.discount_value, coupon.currency)} off
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="capitalize">
                {coupon.duration}
                {coupon.duration === "repeating" && coupon.duration_in_months
                  ? ` (${coupon.duration_in_months} months)`
                  : ""}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Applicable Plans</span>
              <span className="capitalize">
                {coupon.applicable_plans
                  ? coupon.applicable_plans.join(", ")
                  : "All plans"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valid From</span>
              <span>{new Date(coupon.valid_from).toLocaleDateString()}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span>
                {coupon.expires_at
                  ? new Date(coupon.expires_at).toLocaleDateString()
                  : "Never"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe Coupon ID</span>
              <span className="font-mono text-xs">
                {coupon.stripe_coupon_id || "N/A"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(coupon.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Stats & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Times Used</span>
                <span className="font-semibold">{coupon.current_uses}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Uses</span>
                <span>{coupon.max_uses ?? "Unlimited"}</span>
              </div>
              {usesRemaining !== null && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span
                      className={
                        usesRemaining <= 0
                          ? "font-semibold text-red-600"
                          : ""
                      }
                    >
                      {usesRemaining}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <CouponActionsClient
                couponId={coupon.id}
                isActive={coupon.is_active}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Redemptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Redemptions ({redemptions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Redeemed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions?.map((r: any) => {
                const profile = Array.isArray(r.doctor?.profile)
                  ? r.doctor.profile[0]
                  : r.doctor?.profile;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {profile?.first_name} {profile?.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile?.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {r.plan_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(r.redeemed_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!redemptions || redemptions.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No redemptions yet
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
