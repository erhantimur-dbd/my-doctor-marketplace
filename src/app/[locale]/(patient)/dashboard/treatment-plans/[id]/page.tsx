import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MapPin,
  Stethoscope,
  FileText,
  CheckCircle,
  CreditCard,
  Wallet,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { BookTreatmentSessionDialog } from "../book-treatment-session-dialog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care Plan Details",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          Pending
        </Badge>
      );
    case "accepted":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          Accepted
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
          Completed
        </Badge>
      );
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "expired":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Expired
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getBookingStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "approved":
      return (
        <Badge
          variant="secondary"
          className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
        >
          Confirmed
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="secondary"
          className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          Completed
        </Badge>
      );
    case "pending_payment":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
        >
          Pending Payment
        </Badge>
      );
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function TreatmentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Fetch treatment plan with doctor details
  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select(
      `
      *,
      doctor:doctors!inner(
        id,
        slug,
        title,
        clinic_name,
        address,
        consultation_types,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
        specialties:doctor_specialties(
          specialty:specialties(name_key),
          is_primary
        )
      )
    `
    )
    .eq("id", id)
    .eq("patient_id", user.id)
    .single();

  if (planError || !plan) {
    notFound();
  }

  // Fetch bookings linked to this treatment plan
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      appointment_date,
      start_time,
      end_time,
      status,
      consultation_type,
      consultation_fee_cents,
      platform_fee_cents,
      total_amount_cents,
      currency,
      paid_at,
      created_at
    `
    )
    .eq("treatment_plan_id", plan.id)
    .order("appointment_date", { ascending: true });

  const doctor: any = Array.isArray(plan.doctor)
    ? plan.doctor[0]
    : plan.doctor;
  const profile: any = doctor?.profile
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;
  const doctorName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Doctor";
  const doctorTitle = doctor?.title ? `${doctor.title} ` : "Dr. ";

  const primarySpecialty = doctor?.specialties?.find(
    (s: any) => s.is_primary
  )?.specialty;

  const progressPct = Math.round(
    (plan.sessions_completed / plan.total_sessions) * 100
  );
  const isActive = ["accepted", "in_progress"].includes(plan.status);
  const sessionsRemaining = plan.total_sessions - plan.sessions_completed;

  // Calculate payment summary
  const sessionList = bookings || [];
  const paidBookings = sessionList.filter(
    (b: any) => b.paid_at || b.status === "confirmed" || b.status === "completed"
  );
  const totalPaidCents = plan.payment_type === "pay_full"
    ? (plan.paid_at ? plan.discounted_total_cents + plan.total_platform_fee_cents : 0)
    : paidBookings.reduce(
        (sum: number, b: any) => sum + (b.total_amount_cents || 0),
        0
      );

  const totalPlanCostCents =
    plan.discounted_total_cents + plan.total_platform_fee_cents;
  const remainingCents = Math.max(0, totalPlanCostCents - totalPaidCents);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/treatment-plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Care Plans
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{plan.title}</h1>
            {getStatusBadge(plan.status)}
          </div>
          <p className="mt-1 text-muted-foreground">
            {plan.service_name} &middot;{" "}
            {plan.consultation_type === "video" ? "Video" : "In-Person"}{" "}
            &middot; {plan.session_duration_minutes} min per session
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This care plan is set by your doctor. Please discuss any
            significant treatment with your NHS GP.
          </p>
        </div>
        {isActive && sessionsRemaining > 0 && (
          <BookTreatmentSessionDialog
            treatmentPlanId={plan.id}
            doctorId={doctor.id}
            consultationType={plan.consultation_type}
            durationMinutes={plan.session_duration_minutes}
            serviceName={plan.service_name}
            paymentType={plan.payment_type}
            planTitle={plan.title}
          />
        )}
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {plan.sessions_completed} of {plan.total_sessions} sessions
                completed
              </span>
              <span className="font-semibold">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-3" />
            {isActive && sessionsRemaining > 0 && (
              <p className="text-xs text-muted-foreground">
                {sessionsRemaining} session{sessionsRemaining !== 1 ? "s" : ""}{" "}
                remaining
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Doctor Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-4 w-4" />
              Your Doctor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={doctorName} />
                ) : null}
                <AvatarFallback className="text-lg">
                  {profile?.first_name?.charAt(0) || "D"}
                  {profile?.last_name?.charAt(0) || ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link
                  href={`/doctors/${doctor.slug}`}
                  className="font-semibold hover:underline"
                >
                  {doctorTitle}
                  {doctorName}
                </Link>
                {primarySpecialty && (
                  <p className="text-sm text-muted-foreground">
                    {primarySpecialty.name_key
                      .split("_")
                      .map(
                        (w: string) =>
                          w.charAt(0).toUpperCase() + w.slice(1)
                      )
                      .join(" ")}
                  </p>
                )}
                {doctor.clinic_name && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {doctor.clinic_name}
                  </p>
                )}
                {doctor.address && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {doctor.address}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Payment Type</span>
              <Badge variant="secondary" className="gap-1">
                {plan.payment_type === "pay_full" ? (
                  <>
                    <Wallet className="h-3 w-3" />
                    Pay Full
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3 w-3" />
                    Pay Per Visit
                  </>
                )}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Price per session
              </span>
              <span>
                {formatCurrency(plan.unit_price_cents, plan.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Sessions ({plan.total_sessions})
              </span>
              <span>
                {formatCurrency(
                  plan.unit_price_cents * plan.total_sessions,
                  plan.currency
                )}
              </span>
            </div>
            {plan.discount_type && plan.discount_value && (
              <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                <span>
                  Discount{" "}
                  {plan.discount_type === "percentage"
                    ? `(${plan.discount_value}%)`
                    : ""}
                </span>
                <span>
                  -
                  {formatCurrency(
                    plan.unit_price_cents * plan.total_sessions -
                      plan.discounted_total_cents,
                    plan.currency
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform fee</span>
              <span>
                {formatCurrency(
                  plan.total_platform_fee_cents,
                  plan.currency
                )}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>
                {formatCurrency(totalPlanCostCents, plan.currency)}
              </span>
            </div>
            {plan.payment_type === "pay_per_visit" && (
              <>
                <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Paid so far</span>
                  <span>
                    {formatCurrency(totalPaidCents, plan.currency)}
                  </span>
                </div>
                {remainingCents > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Remaining</span>
                    <span>
                      {formatCurrency(remainingCents, plan.currency)}
                    </span>
                  </div>
                )}
              </>
            )}
            {plan.payment_type === "pay_full" && plan.paid_at && (
              <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                <span>Paid in full</span>
                <CheckCircle className="h-4 w-4" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description & Notes */}
      {(plan.description || plan.custom_notes) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Plan Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Description
                </h4>
                <p className="text-sm whitespace-pre-wrap">
                  {plan.description}
                </p>
              </div>
            )}
            {plan.custom_notes && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Notes from Doctor
                </h4>
                <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                  {plan.custom_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Session History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sessions booked yet.{" "}
              {isActive && "Use the button above to book your next session."}
            </p>
          ) : (
            <div className="space-y-3">
              {sessionList.map((booking: any, index: number) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {new Date(
                            booking.appointment_date + "T00:00:00"
                          ).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {getBookingStatusBadge(booking.status)}
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {booking.start_time.slice(0, 5)} -{" "}
                        {booking.end_time.slice(0, 5)}
                        <span className="ml-2">
                          {booking.consultation_type === "video" ? (
                            <Video className="inline h-3 w-3" />
                          ) : (
                            <MapPin className="inline h-3 w-3" />
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  {booking.total_amount_cents > 0 && (
                    <span className="text-sm font-medium">
                      {formatCurrency(
                        booking.total_amount_cents,
                        booking.currency
                      )}
                    </span>
                  )}
                  {booking.total_amount_cents === 0 &&
                    plan.payment_type === "pay_full" && (
                      <span className="text-xs text-muted-foreground">
                        Included
                      </span>
                    )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
