import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  Video,
  User,
  MapPin,
  ArrowLeft,
  CreditCard,
  FileText,
  Star,
  Stethoscope,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Details",
};

type BookingDetail = {
  id: string;
  booking_number: string;
  start_time: string;
  end_time: string;
  status: string;
  consultation_type: string;
  consultation_fee_cents: number;
  platform_fee_cents: number;
  total_amount_cents: number;
  currency: string;
  patient_notes: string | null;
  cancellation_reason: string | null;
  payment_status: string | null;
  payment_intent_id: string | null;
  video_room_url: string | null;
  created_at: string;
  patient_id: string;
  doctor_id: string;
  doctor: {
    id: string;
    slug: string;
    title: string | null;
    clinic_name: string | null;
    address: string | null;
    consultation_fee_cents: number;
    base_currency: string;
    profile: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
    location: {
      city: string;
      country_code: string;
    } | null;
    specialties: {
      specialty: {
        name_key: string;
        slug: string;
      };
      is_primary: boolean;
    }[];
  };
};

function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "approved":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "pending_payment":
    case "pending_approval":
      return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    case "completed":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
    default:
      return "";
  }
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
    case "approved":
      return "default";
    case "pending_payment":
    case "pending_approval":
      return "secondary";
    case "completed":
      return "outline";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function getPaymentStatusColor(status: string | null): string {
  switch (status) {
    case "paid":
    case "succeeded":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "pending":
      return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    case "refunded":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "failed":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
    default:
      return "";
  }
}

interface BookingDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      doctor:doctors(
        id, slug, title, clinic_name, address,
        consultation_fee_cents, base_currency,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
        location:locations(city, country_code),
        specialties:doctor_specialties(
          specialty:specialties(name_key, slug),
          is_primary
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !booking) notFound();

  const typedBooking = booking as unknown as BookingDetail;

  // Verify booking belongs to current user
  if (typedBooking.patient_id !== user.id) notFound();

  // Check if there's already a review for this booking
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", typedBooking.id)
    .eq("patient_id", user.id)
    .single();

  const doctor = typedBooking.doctor;
  const doctorName = `${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();
  const startDate = new Date(typedBooking.start_time);
  const endDate = new Date(typedBooking.end_time);
  const now = new Date();

  const primarySpecialty =
    doctor.specialties?.find((s) => s.is_primary)?.specialty ||
    doctor.specialties?.[0]?.specialty;

  const canCancel =
    typedBooking.status === "confirmed" || typedBooking.status === "approved";
  const isVideo = typedBooking.consultation_type === "video";
  const canJoinVideo =
    isVideo &&
    typedBooking.status === "confirmed" &&
    typedBooking.video_room_url;

  // Allow joining 10 minutes before start
  const joinWindowStart = new Date(startDate.getTime() - 10 * 60 * 1000);
  const isWithinJoinWindow = now >= joinWindowStart && now <= endDate;

  const canWriteReview =
    typedBooking.status === "completed" && !existingReview;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/bookings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Bookings
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-sm text-muted-foreground">
            Booking #{typedBooking.booking_number}
          </p>
        </div>
        <Badge
          variant={getStatusBadgeVariant(typedBooking.status)}
          className={`text-sm ${getStatusColor(typedBooking.status)}`}
        >
          {formatStatusLabel(typedBooking.status)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Doctor info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4" />
                Doctor Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  {doctor.profile.avatar_url ? (
                    <AvatarImage
                      src={doctor.profile.avatar_url}
                      alt={doctorName}
                    />
                  ) : null}
                  <AvatarFallback className="text-lg">
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/doctors/${doctor.slug}`}
                    className="font-semibold hover:text-primary hover:underline"
                  >
                    {doctorName}
                  </Link>
                  {primarySpecialty && (
                    <p className="text-sm text-muted-foreground">
                      {primarySpecialty.name_key
                        .replace("specialty.", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                  )}
                  {doctor.location && (
                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {doctor.location.city}, {doctor.location.country_code}
                    </div>
                  )}
                  {doctor.clinic_name && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {doctor.clinic_name}
                    </p>
                  )}
                  {!isVideo && doctor.address && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <MapPin className="mr-1 inline h-3.5 w-3.5" />
                      {doctor.address}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointment details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Appointment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Date
                  </p>
                  <p className="mt-1 font-medium">
                    {startDate.toLocaleDateString(
                      locale === "de"
                        ? "de-DE"
                        : locale === "tr"
                          ? "tr-TR"
                          : "en-GB",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Time
                  </p>
                  <p className="mt-1 font-medium">
                    {startDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {endDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Consultation Type
                  </p>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {isVideo ? (
                        <>
                          <Video className="mr-1 h-3 w-3" />
                          Video Call
                        </>
                      ) : (
                        <>
                          <User className="mr-1 h-3 w-3" />
                          In Person
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Booked On
                  </p>
                  <p className="mt-1 font-medium">
                    {new Date(typedBooking.created_at).toLocaleDateString(
                      locale === "de"
                        ? "de-DE"
                        : locale === "tr"
                          ? "tr-TR"
                          : "en-GB",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>
              </div>

              {typedBooking.patient_notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      <FileText className="mr-1 inline h-3.5 w-3.5" />
                      Your Notes
                    </p>
                    <p className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                      {typedBooking.patient_notes}
                    </p>
                  </div>
                </>
              )}

              {typedBooking.cancellation_reason && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-red-600">
                      Cancellation Reason
                    </p>
                    <p className="mt-2 rounded-md bg-red-50 p-3 text-sm dark:bg-red-950">
                      {typedBooking.cancellation_reason}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Consultation Fee</span>
                <span>
                  {formatCurrency(
                    typedBooking.consultation_fee_cents,
                    typedBooking.currency,
                    locale
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span>
                  {formatCurrency(
                    typedBooking.platform_fee_cents,
                    typedBooking.currency,
                    locale
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span className="text-lg">
                  {formatCurrency(
                    typedBooking.total_amount_cents,
                    typedBooking.currency,
                    locale
                  )}
                </span>
              </div>
              {typedBooking.payment_status && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment Status</span>
                  <Badge
                    variant="outline"
                    className={getPaymentStatusColor(
                      typedBooking.payment_status
                    )}
                  >
                    {formatStatusLabel(typedBooking.payment_status)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canJoinVideo && (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!isWithinJoinWindow}
                  asChild={isWithinJoinWindow}
                >
                  {isWithinJoinWindow ? (
                    <a
                      href={typedBooking.video_room_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Join Video Call
                    </a>
                  ) : (
                    <>
                      <Video className="mr-2 h-4 w-4" />
                      Join Video Call
                      <span className="ml-1 text-xs opacity-70">
                        (available 10 min before)
                      </span>
                    </>
                  )}
                </Button>
              )}

              {canCancel && (
                <CancelBookingDialog
                  bookingId={typedBooking.id}
                  bookingNumber={typedBooking.booking_number}
                />
              )}

              {canWriteReview && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/reviews">
                    <Star className="mr-2 h-4 w-4" />
                    Write a Review
                  </Link>
                </Button>
              )}

              <Button variant="ghost" className="w-full" asChild>
                <Link href={`/doctors/${doctor.slug}`}>
                  View Doctor Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
