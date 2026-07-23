import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import {
  BookingSuccessAnimation,
  AnimatedSuccessIcon,
} from "@/components/shared/booking-success-animation";
import { resolveConfirmationLookup } from "@/lib/booking/confirmation-params";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Booking Confirmed",
  description: "Your appointment has been successfully booked.",
};

interface BookingConfirmationPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    session_id?: string;
    booking_id?: string;
    wallet?: string;
  }>;
}

const bookingSelect = `
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
      is_guest,
      patient_id,
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
    `;

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: BookingConfirmationPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("booking");
  const lookup = resolveConfirmationLookup(sp);

  if (lookup.mode === "invalid") {
    redirect(`/${locale}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let bookingId: string | null = null;
  let allowAdminGuestFallback = false;

  if (lookup.mode === "stripe_session") {
    let stripeSession;
    try {
      stripeSession = await getStripe().checkout.sessions.retrieve(
        lookup.sessionId
      );
    } catch {
      redirect(`/${locale}`);
    }
    bookingId = stripeSession.metadata?.booking_id ?? null;
    if (!bookingId) {
      redirect(`/${locale}`);
    }
    // Stripe session_id proves payment ownership for guest shadow accounts.
    allowAdminGuestFallback = true;
  } else {
    // Wallet-only path — patient must be signed in and own the booking (RLS).
    bookingId = lookup.bookingId;
    if (!user) {
      redirect(`/${locale}/login`);
    }
    allowAdminGuestFallback = false;
  }

  let { data: booking } = await supabase
    .from("bookings")
    .select(bookingSelect)
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking && allowAdminGuestFallback) {
    const admin = createAdminClient();
    const res = await admin
      .from("bookings")
      .select(bookingSelect)
      .eq("id", bookingId)
      .maybeSingle();
    booking = res.data;
  }

  if (!booking) {
    redirect(`/${locale}`);
  }

  // Wallet path: enforce ownership even if RLS misconfigured
  if (
    lookup.mode === "wallet_booking" &&
    user &&
    (booking as { patient_id?: string }).patient_id &&
    (booking as { patient_id: string }).patient_id !== user.id
  ) {
    redirect(`/${locale}`);
  }

  const isGuestBooking =
    !user || (booking as { is_guest?: boolean }).is_guest === true;

  const doctor: any = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  const profile: any = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;
  const fullName =
    `${doctor.title || "Dr."} ${profile.first_name} ${profile.last_name}`.trim();

  const primarySpecialty =
    doctor.specialties?.find((s: any) => s.is_primary)?.specialty ||
    doctor.specialties?.[0]?.specialty;

  const specialtyName = primarySpecialty
    ? formatSpecialtyName(primarySpecialty.name_key)
    : null;

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString(locale === "en" ? "en-GB" : locale, {
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

  const policyKey =
    doctor.cancellation_policy === "flexible"
      ? "flexible_policy"
      : doctor.cancellation_policy === "moderate"
        ? "moderate_policy"
        : "strict_policy";

  return (
    <div className="container mx-auto px-4 py-12">
      <BookingSuccessAnimation>
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <AnimatedSuccessIcon>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </AnimatedSuccessIcon>

              <h1 className="text-2xl font-bold">{t("booking_confirmed")}</h1>
              <p className="text-muted-foreground">
                {t("payment_confirm_note")}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("booking_number")}
                </p>
                <p className="mt-1 text-lg font-bold tracking-wider">
                  {booking.booking_number}
                </p>
              </div>

              <Separator />

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

              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {(booking as { payment_mode?: string }).payment_mode ===
                  "deposit"
                    ? t("deposit_paid")
                    : t("total")}
                </span>
                <span className="text-lg font-bold">
                  {(booking as { payment_mode?: string }).payment_mode ===
                    "deposit" &&
                  (booking as { deposit_amount_cents?: number })
                    .deposit_amount_cents != null
                    ? formatCurrency(
                        (booking as { deposit_amount_cents: number })
                          .deposit_amount_cents,
                        booking.currency
                      )
                    : formatCurrency(
                        booking.total_amount_cents,
                        booking.currency
                      )}
                </span>
              </div>

              {(booking as { payment_mode?: string }).payment_mode ===
                "deposit" &&
                (booking as { remainder_due_cents?: number })
                  .remainder_due_cents != null && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-700 dark:text-amber-400">
                        {t("due_on_day")}
                      </span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatCurrency(
                          (booking as { remainder_due_cents: number })
                            .remainder_due_cents,
                          booking.currency
                        )}
                      </span>
                    </div>

                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t("deposit_info")}
                      </p>
                    </div>
                  </>
                )}

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t(policyKey)}
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              {isGuestBooking && !user ? (
                <>
                  <Button className="w-full" asChild>
                    <Link href="/forgot-password">
                      Set a password to manage bookings
                    </Link>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    We also emailed you a secure claim link — open it to set
                    your password and manage this booking. Prefer not to wait?
                    Use the button above with the same email you booked with.
                  </p>
                </>
              ) : (
                <Button className="w-full" asChild>
                  <Link href="/dashboard/bookings">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    View My Bookings
                  </Link>
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </BookingSuccessAnimation>
    </div>
  );
}
