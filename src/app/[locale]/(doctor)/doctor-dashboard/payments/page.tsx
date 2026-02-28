import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  Clock,
  ExternalLink,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, base_currency, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("id")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return <UpgradePrompt feature="Payments" />;
  }

  // Fetch completed/confirmed bookings with payments
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, appointment_date, consultation_fee_cents, platform_fee_cents, total_amount_cents, currency, status, paid_at, patient:profiles!bookings_patient_id_fkey(first_name, last_name)"
    )
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"])
    .order("appointment_date", { ascending: false });

  const allBookings = (bookings || []) as any[];

  // Calculate stats
  const totalRevenue = allBookings.reduce(
    (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0];
  const thisMonthBookings = allBookings.filter(
    (b) => b.appointment_date >= startOfMonth
  );
  const thisMonthRevenue = thisMonthBookings.reduce(
    (sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );

  const pendingPayouts = allBookings
    .filter((b) => b.status !== "completed" && b.paid_at)
    .reduce((sum, b) => sum + (b.total_amount_cents - b.platform_fee_cents), 0);

  const currency = doctor.base_currency || "EUR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Track your earnings and manage payouts
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalRevenue, currency)}
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
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {formatCurrency(thisMonthRevenue, currency)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payouts</p>
              <p className="text-2xl font-bold">
                {formatCurrency(pendingPayouts, currency)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Connect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Connect
          </CardTitle>
          <CardDescription>
            Connect your Stripe account to receive payouts directly to your bank
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!doctor.stripe_account_id ? (
            <div className="flex items-start gap-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800">
                  Stripe account not connected
                </p>
                <p className="mt-1 text-sm text-yellow-700">
                  Connect your Stripe account to start receiving payouts. You will
                  be redirected to Stripe to complete the onboarding process.
                </p>
                <form action="/api/stripe/connect" method="POST" className="mt-3">
                  <Button type="submit" size="sm">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Connect Stripe Account
                  </Button>
                </form>
              </div>
            </div>
          ) : !doctor.stripe_onboarding_complete ? (
            <div className="flex items-start gap-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-800">
                  Onboarding incomplete
                </p>
                <p className="mt-1 text-sm text-orange-700">
                  Your Stripe account setup is not yet complete. Please finish the
                  onboarding process to enable payouts.
                </p>
                <form action="/api/stripe/connect" method="POST" className="mt-3">
                  <Button type="submit" size="sm" variant="outline">
                    Complete Onboarding
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <CreditCard className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="font-medium text-green-800">
                    Stripe account connected
                  </p>
                  <p className="text-sm text-green-700">
                    Payouts are{" "}
                    {doctor.stripe_payouts_enabled ? "enabled" : "pending"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Stripe Dashboard
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {allBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No transactions yet. Payments will appear here after your first
                booking.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Booking #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      {new Date(booking.appointment_date).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {booking.booking_number}
                    </TableCell>
                    <TableCell>
                      {booking.patient.first_name} {booking.patient.last_name}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        booking.total_amount_cents,
                        booking.currency || currency
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      -{formatCurrency(
                        booking.platform_fee_cents,
                        booking.currency || currency
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(
                        booking.total_amount_cents - booking.platform_fee_cents,
                        booking.currency || currency
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          booking.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {booking.paid_at
                          ? booking.status === "completed"
                            ? "Paid"
                            : "Pending"
                          : "Awaiting Payment"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
