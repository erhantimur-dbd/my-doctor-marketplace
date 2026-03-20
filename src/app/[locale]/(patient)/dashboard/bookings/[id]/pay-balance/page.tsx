import { getReschedulePaymentIntent } from "@/actions/reschedule-payment";
import { PayBalanceClient } from "./pay-balance-client";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function PayBalancePage({ params }: Props) {
  const { id, locale } = await params;

  const { clientSecret, booking, error } = await getReschedulePaymentIntent(id);

  if (error || !clientSecret || !booking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <CardTitle>Payment Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error ?? "This payment link is no longer active."}
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/bookings">Back to Bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Complete Reschedule Payment</h1>
        <p className="text-sm text-muted-foreground">
          Pay the balance to confirm your rescheduled appointment
        </p>
      </div>

      <PayBalanceClient
        clientSecret={clientSecret}
        publishableKey={publishableKey}
        booking={booking}
        bookingId={id}
        locale={locale}
      />
    </div>
  );
}
