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
import { formatCurrency } from "@/lib/utils/currency";
import { DollarSign, TrendingUp, CreditCard } from "lucide-react";

export default async function AdminPaymentsPage() {
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

  // Platform fees
  const { data: fees } = await supabase
    .from("platform_fees")
    .select(
      `id, amount_cents, currency, fee_type, created_at,
       booking:bookings(booking_number),
       doctor:doctors(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const totalFees =
    fees?.reduce(
      (sum: number, f: { amount_cents: number }) => sum + f.amount_cents,
      0
    ) || 0;

  // Paid bookings
  const { data: paidBookings } = await supabase
    .from("bookings")
    .select("total_amount_cents, platform_fee_cents")
    .not("paid_at", "is", null);

  const totalGMV =
    paidBookings?.reduce(
      (sum: number, b: { total_amount_cents: number }) =>
        sum + b.total_amount_cents,
      0
    ) || 0;

  const totalPlatformFees =
    paidBookings?.reduce(
      (sum: number, b: { platform_fee_cents: number }) =>
        sum + b.platform_fee_cents,
      0
    ) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment Management</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total GMV (Gross)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalGMV, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Platform Revenue
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalPlatformFees, "EUR")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Take Rate</p>
              <p className="text-2xl font-bold">
                {totalGMV > 0
                  ? `${((totalPlatformFees / totalGMV) * 100).toFixed(1)}%`
                  : "15%"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Platform Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees?.map(
                (fee: any) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-mono text-sm">
                      {fee.booking?.booking_number || "-"}
                    </TableCell>
                    <TableCell>
                      {fee.doctor
                        ? `${fee.doctor.profile.first_name} ${fee.doctor.profile.last_name}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{fee.fee_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(fee.amount_cents, fee.currency)}
                    </TableCell>
                    <TableCell>
                      {new Date(fee.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!fees || fees.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No platform fees recorded yet
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
