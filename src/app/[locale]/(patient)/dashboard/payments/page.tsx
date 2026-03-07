import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, TrendingUp, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { PaymentFilters } from "./payment-filters";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment History" };

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
    case "approved":
      return "default";
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Build query for paid bookings with doctor info
  let query = supabase
    .from("bookings")
    .select(
      `
      id, booking_number, appointment_date, start_time, consultation_type,
      total_amount_cents, currency, status, paid_at, created_at,
      doctor:doctors(
        title, clinic_name,
        profile:profiles(first_name, last_name)
      )
    `
    )
    .eq("patient_id", user.id)
    .in("status", ["confirmed", "approved", "completed"])
    .gt("total_amount_cents", 0)
    .order("appointment_date", { ascending: false });

  // Apply date filters
  if (from) {
    query = query.gte("appointment_date", from);
  }
  if (to) {
    query = query.lte("appointment_date", to);
  }

  const { data: payments } = await query;

  // Compute KPI values
  const totalPayments = payments?.length ?? 0;
  const totalSpent = (payments || []).reduce(
    (sum, b: any) => sum + b.total_amount_cents,
    0
  );
  const avgPayment =
    totalPayments > 0 ? Math.round(totalSpent / totalPayments) : 0;

  // Primary currency
  const currencyCounts: Record<string, number> = {};
  (payments || []).forEach((b: any) => {
    const cur = (b.currency || "EUR").toUpperCase();
    currencyCounts[cur] = (currencyCounts[cur] || 0) + 1;
  });
  const primaryCurrency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "EUR";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold">Payment History</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="text-2xl font-bold">{totalPayments}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalSpent, primaryCurrency)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Payment</p>
              <p className="text-2xl font-bold">
                {formatCurrency(avgPayment, primaryCurrency)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <PaymentFilters from={from} to={to} />

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Payments
            {(from || to) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {from && `From ${from}`}
                {from && to && " "}
                {to && `To ${to}`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments?.map((payment: any) => {
                const doctor: any = Array.isArray(payment.doctor)
                  ? payment.doctor[0]
                  : payment.doctor;
                const doctorProfile: any = doctor
                  ? Array.isArray(doctor.profile)
                    ? doctor.profile[0]
                    : doctor.profile
                  : null;

                return (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {new Date(payment.appointment_date).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {doctor?.title}{" "}
                      {doctorProfile?.first_name}{" "}
                      {doctorProfile?.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {payment.consultation_type === "video"
                          ? "Video Call"
                          : "In-Person"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(
                        payment.total_amount_cents,
                        payment.currency
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(payment.currency || "EUR").toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(payment.status)}
                        className="text-xs capitalize"
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!payments || payments.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No payments found
                    {(from || to) && " for the selected date range"}
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
