import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Tag } from "lucide-react";

function formatDiscount(type: string, value: number, currency: string) {
  if (type === "percentage") return `${value}%`;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value / 100);
}

export default async function AdminCouponsPage() {
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

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  const activeCount = coupons?.filter((c: any) => c.is_active).length || 0;
  const totalRedemptions = coupons?.reduce((sum: number, c: any) => sum + (c.current_uses || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage promotional coupons for doctor subscriptions
          </p>
        </div>
        <Link href="/admin/coupons/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Coupon
          </Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <Badge variant="secondary" className="px-3 py-1">
          {activeCount} active
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          {totalRedemptions} total redemptions
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            All Coupons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Plans</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons?.map((coupon: any) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">
                    {coupon.code}
                  </TableCell>
                  <TableCell>{coupon.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {formatDiscount(coupon.discount_type, coupon.discount_value, coupon.currency)}
                      {coupon.discount_type === "percentage" ? " off" : " off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {coupon.applicable_plans ? (
                      <span className="text-sm capitalize">
                        {coupon.applicable_plans.join(", ")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">All plans</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {coupon.current_uses}
                    {coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                  </TableCell>
                  <TableCell>
                    {coupon.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {coupon.expires_at ? (
                      <span className={`text-sm ${new Date(coupon.expires_at) < new Date() ? "text-red-500" : ""}`}>
                        {new Date(coupon.expires_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/coupons/${coupon.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {(!coupons || coupons.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No coupons created yet
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
