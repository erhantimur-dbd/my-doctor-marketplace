import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MapPin,
  CreditCard,
  User,
  Stethoscope,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

const statusColors: Record<string, string> = {
  pending_payment: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled_patient: "bg-red-100 text-red-700",
  cancelled_doctor: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
  refunded: "bg-orange-100 text-orange-700",
};

export default async function AdminBookingDetailPage({
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

  const { data: bookingData } = await supabase
    .from("bookings")
    .select(
      `*,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone),
       doctor:doctors!inner(
         slug, clinic_name,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)
       )`
    )
    .eq("id", id)
    .single();

  if (!bookingData) redirect("/en/admin/bookings");

  const booking: any = bookingData;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Bookings
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Booking {booking.booking_number}
          </h1>
          <p className="text-muted-foreground">
            Created{" "}
            {new Date(booking.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[booking.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {booking.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {new Date(booking.appointment_date).toLocaleDateString(
                  "en-GB",
                  { weekday: "long", day: "numeric", month: "long", year: "numeric" }
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span>{booking.duration_minutes} minutes</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline">
                {booking.consultation_type === "video" ? (
                  <span className="flex items-center gap-1">
                    <Video className="h-3 w-3" /> Video
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> In Person
                  </span>
                )}
              </Badge>
            </div>
            {booking.patient_notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Patient Notes</span>
                  <p className="mt-1 text-sm">{booking.patient_notes}</p>
                </div>
              </>
            )}
            {booking.cancellation_reason && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">
                    Cancellation Reason
                  </span>
                  <p className="mt-1 text-sm text-red-600">
                    {booking.cancellation_reason}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="text-lg font-bold">
                {formatCurrency(booking.total_amount_cents, booking.currency)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consultation Fee</span>
              <span>
                {formatCurrency(
                  booking.consultation_fee_cents,
                  booking.currency
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="text-green-600">
                {formatCurrency(booking.platform_fee_cents, booking.currency)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Doctor Payout</span>
              <span>
                {formatCurrency(
                  booking.total_amount_cents - booking.platform_fee_cents,
                  booking.currency
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Status</span>
              <span>
                {booking.paid_at ? (
                  <Badge className="bg-green-100 text-green-700">
                    Paid{" "}
                    {new Date(booking.paid_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unpaid</Badge>
                )}
              </span>
            </div>
            {booking.stripe_payment_intent_id && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stripe PI</span>
                  <span className="font-mono text-xs">
                    {booking.stripe_payment_intent_id}
                  </span>
                </div>
              </>
            )}
            {booking.refunded_at && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="text-orange-600">
                    {formatCurrency(
                      booking.refund_amount_cents || 0,
                      booking.currency
                    )}{" "}
                    on{" "}
                    {new Date(booking.refunded_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {booking.patient?.first_name} {booking.patient?.last_name}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">{booking.patient?.email}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{booking.patient?.phone || booking.patient_phone || "N/A"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Doctor Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Doctor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <Link
                href={`/doctors/${booking.doctor?.slug}`}
                className="font-medium text-primary hover:underline"
              >
                Dr. {booking.doctor?.profile?.first_name}{" "}
                {booking.doctor?.profile?.last_name}
              </Link>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">
                {booking.doctor?.profile?.email}
              </span>
            </div>
            {booking.doctor?.clinic_name && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clinic</span>
                  <span>{booking.doctor.clinic_name}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
