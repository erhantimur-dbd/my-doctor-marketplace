import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import { formatSpecialtyName } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  LayoutDashboard,
  MapPin,
  Stethoscope,
  Video,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Confirmed",
  description: "Your appointment has been successfully booked.",
};

interface BookingConfirmationPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function BookingConfirmationPage({
  searchParams,
}: BookingConfirmationPageProps) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect("/en");
  }

  // Retrieve the Stripe Checkout Session to get the booking_id
  let stripeSession;
  try {
    stripeSession = await getStripe().checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/en");
  }

  const bookingId = stripeSession.metadata?.booking_id;
  if (!bookingId) {
    redirect("/en");
  }

  // Fetch the booking with doctor details
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      status,
      currency,
      consultation_fee_cents,
      platform_fee_cents,
      total_amount_cents,
      payment_mode,
      deposit_amount_cents,
      deposit_type,
      deposit_value,
      remainder_due_cents,
      patient_notes,
      paid_at,
      doctor:doctors!inner(
        id,
        slug,
        title,
        clinic_name,
        address,
        cancellation_policy,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
        location:locations(city, country_code, timezone),
        specialties:doctor_specialties(
          specialty:specialties(id, name_key, slug),
          is_primary
        )
      )
    `
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    redirect("/en");
  }

  const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const fullName = `${doctor.title || "Dr."} ${profile.first_name} ${profile.last_name}`.trim();

  const primarySpecialty =
    doctor.specialties?.find(
      (s: any) => s.is_primary
    )?.specialty || doctor.specialties?.[0]?.specialty;

  const specialtyName = primarySpecialty
    ? formatSpecialtyName(primarySpecialty.name_key)
    : null;

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(time: string): string {
    const parts = time.split(":");
    return `${parts[0]}:${parts[1]}`;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader className="text-center">
            {/* Success Icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>

            <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
            <p className="text-muted-foreground">
              Your appointment has been successfully booked. You will receive a
              confirmation email shortly.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Booking Number */}
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Booking Reference
              </p>
              <p className="mt-1 text-lg font-bold tracking-wider">
                {booking.booking_number}
              </p>
            </div>

            <Separator />

            {/* Doctor Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Doctor</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{fullName}</p>
                {specialtyName && (
                  <p className="text-xs text-muted-foreground">
                    {specialtyName}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Consultation Type */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {booking.consultation_type === "video" ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">Consultation</span>
              </div>
              <Badge variant="secondary">
                {booking.consultation_type === "video"
                  ? "Video Call"
                  : "In-Person"}
              </Badge>
            </div>

            <Separator />

            {/* Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date</span>
              </div>
              <p className="text-sm font-medium">
                {formatDate(booking.appointment_date)}
              </p>
            </div>

            <Separator />

            {/* Time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Time</span>
              </div>
              <p className="text-sm font-medium">
                {formatTime(booking.start_time)} -{" "}
                {formatTime(booking.end_time)}
              </p>
            </div>

            {/* Location for in-person */}
            {booking.consultation_type === "in_person" &&
              (doctor.clinic_name || doctor.address) && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location</span>
                    </div>
                    <div className="text-right text-sm">
                      {doctor.clinic_name && (
                        <p className="font-medium">{doctor.clinic_name}</p>
                      )}
                      {doctor.address && (
                        <p className="text-muted-foreground">
                          {doctor.address}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

            <Separator />

            {/* Amount Paid */}
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {(booking as any).payment_mode === "deposit"
                  ? (booking as any).deposit_type === "percentage" && (booking as any).deposit_value
                    ? `${(booking as any).deposit_value}% Deposit Paid`
                    : "Deposit Paid"
                  : "Amount Paid"}
              </span>
              <span className="text-lg font-bold">
                {(booking as any).payment_mode === "deposit" && (booking as any).deposit_amount_cents != null
                  ? formatCurrency(
                      (booking as any).deposit_amount_cents + booking.platform_fee_cents,
                      booking.currency
                    )
                  : formatCurrency(
                      booking.total_amount_cents,
                      booking.currency
                    )}
              </span>
            </div>

            {/* Deposit remainder due on the day */}
            {(booking as any).payment_mode === "deposit" && (booking as any).remainder_due_cents != null && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-700 dark:text-amber-400">Due on the Day</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {formatCurrency(
                      (booking as any).remainder_due_cents,
                      booking.currency
                    )}
                  </span>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    You paid a{" "}
                    {(booking as any).deposit_type === "percentage" && (booking as any).deposit_value
                      ? `${(booking as any).deposit_value}% deposit`
                      : "deposit"}{" "}
                    to secure your appointment. The remaining{" "}
                    {formatCurrency(
                      (booking as any).remainder_due_cents,
                      booking.currency
                    )}{" "}
                    is payable directly to the doctor on the day. Deposits are fully refundable if
                    cancelled within the cancellation period.
                  </p>
                </div>
              </>
            )}

            {/* Cancellation Policy Note */}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {doctor.cancellation_policy === "flexible"
                  ? "Flexible cancellation: Free cancellation up to 24 hours before the appointment."
                  : doctor.cancellation_policy === "moderate"
                    ? "Moderate cancellation: Full refund if cancelled 48+ hours before, 50% between 24-48 hours."
                    : "Strict cancellation: Full refund only if cancelled more than 72 hours before the appointment."}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href="/dashboard/bookings">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                View My Bookings
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
