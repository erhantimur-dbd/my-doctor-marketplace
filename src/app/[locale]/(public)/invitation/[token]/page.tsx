import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, MapPin, Video, CalendarDays, Stethoscope, AlertCircle, MessageSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { InvitationClient } from "./invitation-client";
import type { Metadata } from "next";

interface InvitationPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: InvitationPageProps): Promise<Metadata> {
  return {
    title: "Follow-Up Invitation",
    description: "View and accept your follow-up appointment invitation.",
  };
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token, locale } = await params;
  const supabase = await createClient();

  // Fetch invitation with doctor details
  const { data: invitation } = await supabase
    .from("follow_up_invitations")
    .select(`
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
        location:locations(city, country_code)
      )
    `)
    .eq("token", token)
    .single();

  if (!invitation) {
    notFound();
  }

  const inv: any = invitation;
  const doctor: any = Array.isArray(inv.doctor) ? inv.doctor[0] : inv.doctor;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;
  const doctorLocation: any = doctor?.location
    ? (Array.isArray(doctor.location) ? doctor.location[0] : doctor.location)
    : null;

  // Lazy expiry check
  const isExpired = inv.status === "pending" && new Date(inv.expires_at) < new Date();
  if (isExpired) {
    await supabase
      .from("follow_up_invitations")
      .update({ status: "expired" })
      .eq("id", inv.id);
    inv.status = "expired";
  }

  const doctorName = `${doctor?.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const isVideo = inv.consultation_type === "video";

  // Inactive states
  if (inv.status === "expired" || inv.status === "cancelled") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">
            {inv.status === "expired" ? "Invitation Expired" : "Invitation Cancelled"}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {inv.status === "expired"
              ? "This follow-up invitation has expired. Please contact your doctor to request a new one."
              : "This follow-up invitation has been cancelled by the doctor."}
          </p>
        </div>
      </div>
    );
  }

  if (inv.status === "accepted") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <h1 className="text-2xl font-bold">Care Plan Active</h1>
          <p className="mt-4 text-muted-foreground">
            This care plan has already been accepted and paid for.
            You can manage your sessions from your dashboard.
          </p>
        </div>
      </div>
    );
  }

  // pending status — show invitation details
  const discountLabel = inv.discount_type === "percentage"
    ? `${inv.discount_value}%`
    : inv.discount_type === "fixed_amount"
      ? formatCurrency(inv.discount_value, inv.currency)
      : null;

  const subtotal = inv.unit_price_cents * inv.total_sessions;
  const savings = subtotal - inv.discounted_total_cents;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">Follow-Up Invitation</h1>
        <p className="mb-8 text-center text-muted-foreground">
          Review the details and book your follow-up appointment
        </p>

        {/* Doctor Card */}
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4 p-6">
            <Avatar className="h-14 w-14">
              {doctorProfile?.avatar_url ? (
                <AvatarImage src={doctorProfile.avatar_url} alt={doctorName} />
              ) : null}
              <AvatarFallback className="text-lg">
                {doctorProfile?.first_name?.charAt(0) || "D"}
                {doctorProfile?.last_name?.charAt(0) || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{doctorName}</p>
              {doctor?.clinic_name && (
                <p className="text-sm text-muted-foreground">{doctor.clinic_name}</p>
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

        {/* Service & Pricing Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Care Plan Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{inv.service_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="gap-1">
                {isVideo ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                {isVideo ? "Video" : "In-Person"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {inv.duration_minutes} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sessions</span>
              <span className="font-medium">{inv.total_sessions} session{inv.total_sessions > 1 ? "s" : ""}</span>
            </div>

            <hr />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per session</span>
              <span>{formatCurrency(inv.unit_price_cents, inv.currency)}</span>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Your savings ({discountLabel} off)</span>
                <span>−{formatCurrency(savings, inv.currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform fee</span>
              <span>{formatCurrency(inv.platform_fee_cents, inv.currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3 font-semibold text-lg">
              <span>Total</span>
              <span>{formatCurrency(inv.discounted_total_cents + inv.platform_fee_cents, inv.currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Doctor's Note */}
        {inv.doctor_note && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">Note from {doctorName}</p>
                  <p className="text-sm leading-relaxed italic">"{inv.doctor_note}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expiry Notice */}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          This invitation expires on{" "}
          <strong>
            {new Date(inv.expires_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
        </p>

        {/* Interactive Booking Section */}
        <InvitationClient
          invitationId={inv.id}
          token={token}
          doctorId={doctor.id}
          consultationType={inv.consultation_type}
          durationMinutes={inv.duration_minutes}
          locale={locale}
        />
      </div>
    </div>
  );
}
