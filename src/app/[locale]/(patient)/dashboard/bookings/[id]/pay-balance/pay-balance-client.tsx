"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ArrowRight, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/currency";

interface BookingInfo {
  booking_number: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  consultation_type: string;
  reschedule_price_diff_cents: number;
  currency: string;
  doctor_name: string;
  original_booking_id: string | null;
  original_date: string | null;
  original_time: string | null;
  original_doctor_name: string | null;
}

interface Props {
  clientSecret: string;
  publishableKey: string;
  booking: BookingInfo;
  bookingId: string;
  locale: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PayBalanceClient({
  clientSecret,
  publishableKey,
  booking,
  bookingId,
  locale,
}: Props) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);

  const [stripeReady, setStripeReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load Stripe.js lazily and mount the Payment Element
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Dynamically import to avoid SSR issues
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(publishableKey);
      if (!stripe || cancelled) return;

      stripeRef.current = stripe;

      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            fontFamily: "inherit",
            borderRadius: "8px",
          },
        },
      });
      elementsRef.current = elements;

      const paymentElement = elements.create("payment", {
        layout: "tabs",
      });

      if (mountRef.current && !cancelled) {
        paymentElement.mount(mountRef.current);
        setStripeReady(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      // Unmount elements if possible
      try {
        elementsRef.current?.getElement("payment")?.unmount();
      } catch {}
    };
  }, [clientSecret, publishableKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripeRef.current || !elementsRef.current) return;

    setSubmitting(true);
    setError(null);

    const returnUrl = `${window.location.origin}/${locale}/dashboard/bookings/${bookingId}/pay-balance?success=1`;

    const { error: stripeError } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    }
    // If no error, Stripe redirects to return_url
  }

  // Handle redirect-back from Stripe with ?success=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/dashboard/bookings/${bookingId}`);
      }, 3000);
    }
  }, [bookingId, locale, router]);

  if (success) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <CardTitle>Payment Successful!</CardTitle>
          <CardDescription>
            Your rescheduled appointment is confirmed. Redirecting…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const diffAmount = formatCurrency(booking.reschedule_price_diff_cents, booking.currency);

  return (
    <div className="space-y-4">
      {/* Before/After appointment summary */}
      {booking.original_date && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Appointment Change Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                  Original
                </p>
                <p className="font-medium">{formatDate(booking.original_date)}</p>
                <p className="text-muted-foreground">
                  {booking.original_time?.slice(0, 5)}
                </p>
                {booking.original_doctor_name && (
                  <p className="text-muted-foreground">{booking.original_doctor_name}</p>
                )}
              </div>
              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                  New Appointment
                </p>
                <p className="font-medium">{formatDate(booking.appointment_date)}</p>
                <p className="text-muted-foreground">
                  {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
                </p>
                <p className="text-muted-foreground">{booking.doctor_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Balance Due</CardTitle>
              <CardDescription>Booking #{booking.booking_number}</CardDescription>
            </div>
            <p className="text-3xl font-bold text-amber-600">{diffAmount}</p>
          </div>
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              This payment link expires in 24 hours. If not paid, your original appointment will be
              reinstated.
            </AlertDescription>
          </Alert>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Stripe Payment Element mount point */}
            <div
              ref={mountRef}
              className="min-h-[200px]"
              aria-label="Card payment form"
            >
              {!stripeReady && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!stripeReady || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Pay {diffAmount} & Confirm Appointment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Secured by Stripe. Your card details are never stored on our servers.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
