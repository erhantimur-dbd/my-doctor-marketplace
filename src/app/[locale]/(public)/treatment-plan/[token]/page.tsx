import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Clock,
  MapPin,
  Video,
  CalendarDays,
  Stethoscope,
  AlertCircle,
  CreditCard,
  FileText,
  MessageSquare,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { TreatmentPlanClient } from "./treatment-plan-client";
import type { Metadata } from "next";

interface TreatmentPlanPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({
  params,
}: TreatmentPlanPageProps): Promise<Metadata> {
  return {
    title: "Treatment Plan",
    description: "View and accept your treatment plan.",
  };
}

export default async function TreatmentPlanPage({
  params,
}: TreatmentPlanPageProps) {
  const { token, locale } = await params;
  const supabase = await createClient();

  // Fetch treatment plan with doctor details
  const { data: plan } = await supabase
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
        stripe_account_id,
        stripe_onboarding_complete,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
        location:locations(city, country_code),
        specialties:doctor_specialties(
          specialty:specialties(name_key),
          is_primary
        )
      )
    `
    )
    .eq("token", token)
    .single();

  if (!plan) {
    notFound();
  }

  const p: any = plan;
  const doctor: any = Array.isArray(p.doctor) ? p.doctor[0] : p.doctor;
  const doctorProfile: any = doctor?.profile
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;
  const doctorLocation: any = doctor?.location
    ? Array.isArray(doctor.location)
      ? doctor.location[0]
      : doctor.location
    : null;
  const specialties: any[] = Array.isArray(doctor?.specialties)
    ? doctor.specialties
    : [];

  // Lazy expiry check
  const isExpired =
    p.status === "sent" && new Date(p.expires_at) < new Date();
  if (isExpired) {
    await supabase
      .from("treatment_plans")
      .update({ status: "expired" })
      .eq("id", p.id);
    p.status = "expired";
  }

  const doctorName = `${doctor?.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const isVideo = p.consultation_type === "video";
  const primarySpecialty = specialties.find((s: any) => s.is_primary);
  const specialtyName = primarySpecialty?.specialty?.name_key || null;

  // Inactive states
  if (p.status === "expired" || p.status === "cancelled") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">
            {p.status === "expired"
              ? "Treatment Plan Expired"
              : "Treatment Plan Cancelled"}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {p.status === "expired"
              ? "This treatment plan has expired. Please contact your doctor to request a new one."
              : "This treatment plan has been cancelled by the doctor."}
          </p>
        </div>
      </div>
    );
  }

  if (["accepted", "in_progress", "completed"].includes(p.status)) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <h1 className="text-2xl font-bold">Treatment Plan Active</h1>
          <p className="mt-4 text-muted-foreground">
            This treatment plan has already been accepted.
            You can manage your sessions from your dashboard.
          </p>
        </div>
      </div>
    );
  }

  // "sent" status - show full treatment plan details
  const discountLabel =
    p.discount_type === "percentage"
      ? `${p.discount_value}%`
      : p.discount_type === "fixed_amount"
        ? formatCurrency(p.discount_value, p.currency)
        : null;

  const subtotal = p.unit_price_cents * p.total_sessions;
  const savings = subtotal - p.discounted_total_cents;
  const paymentTypeLabel =
    p.payment_type === "pay_full" ? "Full Payment" : "Pay Per Visit";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          Treatment Plan
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          Review the details and accept your treatment plan
        </p>

        {/* Doctor Card */}
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4 p-6">
            <Avatar className="h-14 w-14">
              {doctorProfile?.avatar_url ? (
                <AvatarImage
                  src={doctorProfile.avatar_url}
                  alt={doctorName}
                />
              ) : null}
              <AvatarFallback className="text-lg">
                {doctorProfile?.first_name?.charAt(0) || "D"}
                {doctorProfile?.last_name?.charAt(0) || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{doctorName}</p>
              {specialtyName && (
                <p className="text-sm text-muted-foreground">
                  {specialtyName}
                </p>
              )}
              {doctor?.clinic_name && (
                <p className="text-sm text-muted-foreground">
                  {doctor.clinic_name}
                </p>
              )}
              {doctorLocation && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {doctorLocation.city}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Treatment Plan Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {p.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{p.service_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="gap-1">
                {isVideo ? (
                  <Video className="h-3 w-3" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                {isVideo ? "Video" : "In-Person"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {p.session_duration_minutes} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sessions</span>
              <span className="font-medium">
                {p.total_sessions} session
                {p.total_sessions > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment Type</span>
              <Badge variant="secondary" className="gap-1">
                <CreditCard className="h-3 w-3" />
                {paymentTypeLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per session</span>
              <span>
                {formatCurrency(p.unit_price_cents, p.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {p.total_sessions} session
                {p.total_sessions > 1 ? "s" : ""}
              </span>
              <span>{formatCurrency(subtotal, p.currency)}</span>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Your savings ({discountLabel} off)</span>
                <span>
                  &minus;{formatCurrency(savings, p.currency)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform fee</span>
              <span>
                {formatCurrency(
                  p.total_platform_fee_cents,
                  p.currency
                )}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
              <span>Total</span>
              <span>
                {formatCurrency(
                  p.discounted_total_cents + p.total_platform_fee_cents,
                  p.currency
                )}
              </span>
            </div>
            {p.payment_type === "pay_per_visit" && (
              <p className="text-xs text-muted-foreground">
                You will pay{" "}
                {formatCurrency(
                  Math.round(p.discounted_total_cents / p.total_sessions) +
                    p.platform_fee_per_session_cents,
                  p.currency
                )}{" "}
                per session as you book them.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Doctor's Notes */}
        {p.custom_notes && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Note from {doctorName}
                  </p>
                  <p className="text-sm italic leading-relaxed">
                    &ldquo;{p.custom_notes}&rdquo;
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expiry Notice */}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          This treatment plan expires on{" "}
          <strong>
            {new Date(p.expires_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
        </p>

        {/* Interactive Acceptance Section */}
        <TreatmentPlanClient
          planId={p.id}
          planToken={token}
          paymentType={p.payment_type}
          totalPrice={formatCurrency(
            p.discounted_total_cents + p.total_platform_fee_cents,
            p.currency
          )}
          currency={p.currency}
          doctorId={doctor.id}
          consultationType={p.consultation_type}
          durationMinutes={p.session_duration_minutes}
          locale={locale}
        />
      </div>
    </div>
  );
}
