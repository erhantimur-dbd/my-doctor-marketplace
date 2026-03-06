import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

interface ConfirmedPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export const metadata: Metadata = {
  title: "Treatment Plan Confirmed",
  description: "Your treatment plan has been confirmed.",
};

export default async function InvitationConfirmedPage({ params }: ConfirmedPageProps) {
  const { token, locale } = await params;
  const supabase = await createClient();

  // Fetch invitation with first booking
  const { data: invitation } = await supabase
    .from("follow_up_invitations")
    .select(`
      id,
      service_name,
      total_sessions,
      sessions_booked,
      status,
      doctor:doctors!inner(
        title,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `)
    .eq("token", token)
    .single();

  if (!invitation || invitation.status !== "accepted") {
    redirect(`/${locale}/invitation/${token}`);
  }

  const inv: any = invitation;
  const doctor: any = Array.isArray(inv.doctor) ? inv.doctor[0] : inv.doctor;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;
  const doctorName = `${doctor?.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const remainingSessions = inv.total_sessions - inv.sessions_booked;

  // Fetch first booking details
  const { data: firstBooking } = await supabase
    .from("bookings")
    .select("booking_number, appointment_date, start_time, end_time, consultation_type")
    .eq("invitation_id", inv.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold">Treatment Plan Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your treatment plan with {doctorName} has been confirmed and paid.
        </p>

        {/* First Session Details */}
        {firstBooking && (
          <Card className="mt-6 text-left">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                First Session Booked
              </p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{inv.service_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(firstBooking.appointment_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">
                  {firstBooking.start_time.slice(0, 5)} – {firstBooking.end_time.slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Booking #</span>
                <span className="font-mono text-sm">{firstBooking.booking_number}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Remaining Sessions */}
        {remainingSessions > 0 && (
          <Card className="mt-4 text-left">
            <CardContent className="flex items-center gap-4 p-6">
              <CalendarDays className="h-8 w-8 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold">
                  {remainingSessions} session{remainingSessions > 1 ? "s" : ""} remaining
                </p>
                <p className="text-sm text-muted-foreground">
                  Book your remaining sessions from your Treatment Plans dashboard when you&apos;re ready.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/dashboard/treatment-plans">
            <Button className="w-full gap-2">
              View Treatment Plans
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard/bookings">
            <Button variant="outline" className="w-full">
              View All Bookings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
