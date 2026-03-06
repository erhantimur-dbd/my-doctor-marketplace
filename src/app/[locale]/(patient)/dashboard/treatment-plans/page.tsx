import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, Stethoscope, Video, MapPin, Clock, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { BookSessionDialog } from "./book-session-dialog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Treatment Plans",
  description: "Manage your treatment plans and book follow-up sessions.",
};

export default async function TreatmentPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Fetch accepted invitations with doctor details
  const { data: invitations } = await supabase
    .from("follow_up_invitations")
    .select(`
      id,
      service_name,
      consultation_type,
      duration_minutes,
      unit_price_cents,
      total_sessions,
      sessions_booked,
      discount_type,
      discount_value,
      discounted_total_cents,
      platform_fee_cents,
      currency,
      status,
      doctor_note,
      paid_at,
      created_at,
      doctor:doctors!inner(
        id,
        title,
        slug,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url)
      )
    `)
    .eq("patient_id", user.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  const plans = (invitations || []).map((inv: any) => {
    const doctor = Array.isArray(inv.doctor) ? inv.doctor[0] : inv.doctor;
    const profile = doctor?.profile
      ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
      : null;
    return { ...inv, doctor, doctorProfile: profile };
  });

  const activePlans = plans.filter((p: any) => p.sessions_booked < p.total_sessions);
  const completedPlans = plans.filter((p: any) => p.sessions_booked >= p.total_sessions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Treatment Plans</h1>
        <p className="text-muted-foreground">
          Manage your treatment plans and book follow-up sessions
        </p>
      </div>

      {/* Active Plans */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Active Plans</h2>
        {activePlans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No active treatment plans. When a doctor sends you a follow-up
                invitation, it will appear here after payment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activePlans.map((plan: any) => {
              const doctorName = `${plan.doctor?.title || "Dr."} ${plan.doctorProfile?.first_name || ""} ${plan.doctorProfile?.last_name || ""}`.trim();
              const progressPct = Math.round((plan.sessions_booked / plan.total_sessions) * 100);
              const isVideo = plan.consultation_type === "video";

              return (
                <Card key={plan.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          {plan.doctorProfile?.avatar_url ? (
                            <AvatarImage src={plan.doctorProfile.avatar_url} alt={doctorName} />
                          ) : null}
                          <AvatarFallback>
                            {plan.doctorProfile?.first_name?.charAt(0) || "D"}
                            {plan.doctorProfile?.last_name?.charAt(0) || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{doctorName}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5" />
                            {plan.service_name}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {isVideo ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {isVideo ? "Video" : "In-Person"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {plan.duration_minutes} min
                            </span>
                          </div>
                        </div>
                      </div>
                      <BookSessionDialog
                        invitationId={plan.id}
                        doctorId={plan.doctor.id}
                        consultationType={plan.consultation_type}
                        durationMinutes={plan.duration_minutes}
                        serviceName={plan.service_name}
                      />
                    </div>

                    {/* Progress */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {plan.sessions_booked} of {plan.total_sessions} sessions booked
                        </span>
                        <span className="font-medium">{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Plans */}
      {completedPlans.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Completed Plans</h2>
          <div className="grid gap-4">
            {completedPlans.map((plan: any) => {
              const doctorName = `${plan.doctor?.title || "Dr."} ${plan.doctorProfile?.first_name || ""} ${plan.doctorProfile?.last_name || ""}`.trim();

              return (
                <Card key={plan.id} className="opacity-75">
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        {plan.doctorProfile?.avatar_url ? (
                          <AvatarImage src={plan.doctorProfile.avatar_url} alt={doctorName} />
                        ) : null}
                        <AvatarFallback>
                          {plan.doctorProfile?.first_name?.charAt(0) || "D"}
                          {plan.doctorProfile?.last_name?.charAt(0) || ""}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{doctorName}</p>
                        <p className="text-sm text-muted-foreground">{plan.service_name}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {plan.total_sessions}/{plan.total_sessions} Complete
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
