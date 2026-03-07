import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  Stethoscope,
  Video,
  MapPin,
  Clock,
  CheckCircle,
  FileText,
  ArrowRight,
  Send,
  CreditCard,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { BookSessionDialog } from "./book-session-dialog";
import { BookTreatmentSessionDialog } from "./book-treatment-session-dialog";
import { getPatientTreatmentPlansV2 } from "@/actions/treatment-plan";
import { Link } from "@/i18n/navigation";
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

  // ─── Treatment Plans (from treatment_plans table) ───
  const { pending, active, completed } = await getPatientTreatmentPlansV2();

  // ─── Follow-Up Invitations (existing) ───
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

  const followUpPlans = (invitations || []).map((inv: any) => {
    const doctor = Array.isArray(inv.doctor) ? inv.doctor[0] : inv.doctor;
    const profile = doctor?.profile
      ? Array.isArray(doctor.profile)
        ? doctor.profile[0]
        : doctor.profile
      : null;
    return { ...inv, doctor, doctorProfile: profile };
  });

  const activeFollowUps = followUpPlans.filter(
    (p: any) => p.sessions_booked < p.total_sessions
  );
  const completedFollowUps = followUpPlans.filter(
    (p: any) => p.sessions_booked >= p.total_sessions
  );

  const hasTreatmentPlans =
    pending.length > 0 || active.length > 0 || completed.length > 0;
  const hasFollowUps = activeFollowUps.length > 0 || completedFollowUps.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Treatment Plans</h1>
        <p className="text-muted-foreground">
          Manage your treatment plans and book follow-up sessions
        </p>
      </div>

      {/* ─── Pending Treatment Plans ─── */}
      {pending.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Send className="h-5 w-5 text-amber-500" />
            Pending Plans
          </h2>
          <div className="grid gap-4">
            {pending.map((plan: any) => {
              const doctor = Array.isArray(plan.doctor)
                ? plan.doctor[0]
                : plan.doctor;
              const profile = doctor?.profile
                ? Array.isArray(doctor.profile)
                  ? doctor.profile[0]
                  : doctor.profile
                : null;
              const doctorName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Doctor";

              return (
                <Card
                  key={plan.id}
                  className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          {profile?.avatar_url ? (
                            <AvatarImage
                              src={profile.avatar_url}
                              alt={doctorName}
                            />
                          ) : null}
                          <AvatarFallback>
                            {profile?.first_name?.charAt(0) || "D"}
                            {profile?.last_name?.charAt(0) || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{plan.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Dr. {doctorName}
                          </p>
                          {plan.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {plan.description}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="gap-1 text-xs">
                              <ClipboardList className="h-3 w-3" />
                              {plan.total_sessions} sessions
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="gap-1 text-xs"
                            >
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
                            <Badge variant="outline" className="gap-1 text-xs">
                              {plan.consultation_type === "video" ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <MapPin className="h-3 w-3" />
                              )}
                              {plan.consultation_type === "video"
                                ? "Video"
                                : "In-Person"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Link href={`/treatment-plan/${plan.token}`}>
                        <Badge className="cursor-pointer gap-1 bg-amber-600 hover:bg-amber-700">
                          Review & Accept
                          <ArrowRight className="h-3 w-3" />
                        </Badge>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Active Treatment Plans ─── */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          Active Treatment Plans
        </h2>
        {active.length === 0 ? (
          !hasTreatmentPlans &&
          !hasFollowUps && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No active treatment plans. When a doctor creates a treatment
                  plan for you, it will appear here after you accept it.
                </p>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="grid gap-4">
            {active.map((plan: any) => {
              const doctor = Array.isArray(plan.doctor)
                ? plan.doctor[0]
                : plan.doctor;
              const profile = doctor?.profile
                ? Array.isArray(doctor.profile)
                  ? doctor.profile[0]
                  : doctor.profile
                : null;
              const doctorName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Doctor";
              const progressPct = Math.round(
                (plan.sessions_completed / plan.total_sessions) * 100
              );

              return (
                <Card key={plan.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          {profile?.avatar_url ? (
                            <AvatarImage
                              src={profile.avatar_url}
                              alt={doctorName}
                            />
                          ) : null}
                          <AvatarFallback>
                            {profile?.first_name?.charAt(0) || "D"}
                            {profile?.last_name?.charAt(0) || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/dashboard/treatment-plans/${plan.id}`}
                            className="font-semibold hover:underline"
                          >
                            {plan.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            Dr. {doctorName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {plan.consultation_type === "video" ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <MapPin className="h-3 w-3" />
                              )}
                              {plan.consultation_type === "video"
                                ? "Video"
                                : "In-Person"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {plan.session_duration_minutes} min
                            </span>
                            <Badge
                              variant="secondary"
                              className="gap-1 text-xs"
                            >
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
                        </div>
                      </div>
                      {plan.sessions_completed < plan.total_sessions && (
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
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {plan.sessions_completed} of {plan.total_sessions}{" "}
                          sessions completed
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

      {/* ─── Completed Treatment Plans ─── */}
      {completed.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completed Treatment Plans
          </h2>
          <div className="grid gap-4">
            {completed.map((plan: any) => {
              const doctor = Array.isArray(plan.doctor)
                ? plan.doctor[0]
                : plan.doctor;
              const profile = doctor?.profile
                ? Array.isArray(doctor.profile)
                  ? doctor.profile[0]
                  : doctor.profile
                : null;
              const doctorName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Doctor";

              return (
                <Card key={plan.id} className="opacity-75">
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        {profile?.avatar_url ? (
                          <AvatarImage
                            src={profile.avatar_url}
                            alt={doctorName}
                          />
                        ) : null}
                        <AvatarFallback>
                          {profile?.first_name?.charAt(0) || "D"}
                          {profile?.last_name?.charAt(0) || ""}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/dashboard/treatment-plans/${plan.id}`}
                          className="font-medium hover:underline"
                        >
                          {plan.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          Dr. {doctorName}
                        </p>
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

      {/* ─── Follow-Up Packages section ─── */}
      {hasFollowUps && (
        <>
          <Separator className="my-6" />

          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Stethoscope className="h-5 w-5 text-primary" />
              Follow-Up Packages
            </h2>

            {/* Active Follow-Ups */}
            {activeFollowUps.length > 0 && (
              <div className="grid gap-4">
                {activeFollowUps.map((plan: any) => {
                  const doctorName = `${plan.doctor?.title || "Dr."} ${plan.doctorProfile?.first_name || ""} ${plan.doctorProfile?.last_name || ""}`.trim();
                  const progressPct = Math.round(
                    (plan.sessions_booked / plan.total_sessions) * 100
                  );
                  const isVideo = plan.consultation_type === "video";

                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12">
                              {plan.doctorProfile?.avatar_url ? (
                                <AvatarImage
                                  src={plan.doctorProfile.avatar_url}
                                  alt={doctorName}
                                />
                              ) : null}
                              <AvatarFallback>
                                {plan.doctorProfile?.first_name?.charAt(0) ||
                                  "D"}
                                {plan.doctorProfile?.last_name?.charAt(0) || ""}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{doctorName}</p>
                              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Stethoscope className="h-3.5 w-3.5" />
                                {plan.service_name}
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {isVideo ? (
                                    <Video className="h-3 w-3" />
                                  ) : (
                                    <MapPin className="h-3 w-3" />
                                  )}
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
                              {plan.sessions_booked} of {plan.total_sessions}{" "}
                              sessions booked
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

            {/* Completed Follow-Ups */}
            {completedFollowUps.length > 0 && (
              <div className={activeFollowUps.length > 0 ? "mt-6" : ""}>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Completed Follow-Ups
                </h3>
                <div className="grid gap-4">
                  {completedFollowUps.map((plan: any) => {
                    const doctorName = `${plan.doctor?.title || "Dr."} ${plan.doctorProfile?.first_name || ""} ${plan.doctorProfile?.last_name || ""}`.trim();

                    return (
                      <Card key={plan.id} className="opacity-75">
                        <CardContent className="flex items-center justify-between p-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10">
                              {plan.doctorProfile?.avatar_url ? (
                                <AvatarImage
                                  src={plan.doctorProfile.avatar_url}
                                  alt={doctorName}
                                />
                              ) : null}
                              <AvatarFallback>
                                {plan.doctorProfile?.first_name?.charAt(0) ||
                                  "D"}
                                {plan.doctorProfile?.last_name?.charAt(0) || ""}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{doctorName}</p>
                              <p className="text-sm text-muted-foreground">
                                {plan.service_name}
                              </p>
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
        </>
      )}

      {/* Empty state when nothing at all */}
      {!hasTreatmentPlans && !hasFollowUps && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No treatment plans yet. When a doctor creates a treatment plan for
              you, it will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
