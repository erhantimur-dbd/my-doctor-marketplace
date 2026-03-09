import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Star,
  Calendar,
  MapPin,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { ApprovalSection } from "./approval-section";
import { EditDoctorDialog } from "./edit-doctor-dialog";
import { SendEmailDialog } from "../../components/send-email-dialog";

export default async function AdminDoctorDetailPage({
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

  const { data: doctorData } = await supabase
    .from("doctors")
    .select(
      `*, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, phone, created_at),
       location:locations(city, country_code),
       specialties:doctor_specialties(specialty:specialties(name_key, slug), is_primary)`
    )
    .eq("id", id)
    .single();

  if (!doctorData) redirect("/en/admin/doctors");

  const doctor: any = doctorData;

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", id);

  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", id);

  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("plan_id, status, current_period_end, cancel_at_period_end")
    .eq("doctor_id", id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPlan = (subscription as any)?.plan_id || "free";

  // Fetch approval checklist for this doctor
  const { data: checklistData } = await supabase
    .from("doctor_approval_checklist")
    .select("gmc_verified, website_verified, notes")
    .eq("doctor_id", id)
    .maybeSingle();

  // Stripe Connect health (if connected)
  let stripeAccount: any = null;
  if (doctor.stripe_account_id) {
    try {
      const { getStripe } = await import("@/lib/stripe/client");
      stripeAccount = await getStripe().accounts.retrieve(doctor.stripe_account_id);
    } catch {
      // Ignore errors — just won't show Stripe card
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/doctors"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {doctor.title || "Dr."} {doctor.profile.first_name}{" "}
            {doctor.profile.last_name}
          </h1>
          <p className="text-muted-foreground">{doctor.profile.email}</p>
        </div>
        <Badge
          variant={
            doctor.verification_status === "verified"
              ? "default"
              : doctor.verification_status === "pending"
                ? "secondary"
                : "destructive"
          }
        >
          {doctor.verification_status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Doctor Info</CardTitle>
            <EditDoctorDialog
              doctorId={doctor.id}
              currentValues={{
                consultation_fee_cents: doctor.consultation_fee_cents || 0,
                video_consultation_fee_cents: doctor.video_consultation_fee_cents || 0,
                bio: doctor.bio || "",
                languages: doctor.languages || [],
                years_of_experience: doctor.years_of_experience || 0,
              }}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">GMC Number</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{doctor.gmc_number || "Not provided"}</span>
                {doctor.gmc_number && (
                  <a
                    href="https://www.gmc-uk.org/registration-and-licensing/the-medical-register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Verify on GMC <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-sm">{doctor.slug}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{doctor.profile.phone || "Not provided"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {doctor.location
                  ? `${doctor.location.city}, ${doctor.location.country_code}`
                  : "Not set"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experience</span>
              <span>
                {doctor.years_of_experience
                  ? `${doctor.years_of_experience} years`
                  : "Not set"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Languages</span>
              <span>{doctor.languages?.join(", ") || "Not set"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span>
                {new Date(doctor.profile.created_at).toLocaleDateString()}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subscription</span>
              <span className="flex items-center gap-2">
                {currentPlan === "free" ? (
                  <Badge variant="outline">Free</Badge>
                ) : currentPlan === "professional" ? (
                  <Badge className="bg-blue-600">Professional</Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize">{currentPlan}</Badge>
                )}
                {(subscription as any)?.status && (
                  <span className="text-xs text-muted-foreground">
                    ({(subscription as any).status})
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {Number(doctor.avg_rating).toFixed(1)} ({doctor.total_reviews}{" "}
                reviews)
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bookings</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {bookingCount || 0}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Reviews</span>
              <span>{reviewCount || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active</span>
              <span>
                {doctor.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Featured</span>
              <span>
                {doctor.is_featured ? (
                  <Badge variant="secondary">Yes</Badge>
                ) : (
                  "No"
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe Connected</span>
              <span>
                {doctor.stripe_onboarding_complete ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Connect Health */}
      {stripeAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stripe Connect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Status</span>
              <span className="flex items-center gap-1">
                {stripeAccount.charges_enabled ? (
                  <Badge className="bg-green-600">Active</Badge>
                ) : (
                  <Badge variant="destructive">Restricted</Badge>
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payouts Enabled</span>
              <span>
                {stripeAccount.payouts_enabled ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country</span>
              <span className="uppercase">{stripeAccount.country || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default Currency</span>
              <span className="uppercase">{stripeAccount.default_currency || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout Schedule</span>
              <span className="text-sm">
                {stripeAccount.settings?.payouts?.schedule?.interval === "manual"
                  ? "Manual"
                  : `${stripeAccount.settings?.payouts?.schedule?.interval || "—"} (${stripeAccount.settings?.payouts?.schedule?.delay_days || 0}d delay)`}
              </span>
            </div>
            {stripeAccount.requirements?.currently_due?.length > 0 && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-orange-600">
                    Action Required: {stripeAccount.requirements.currently_due.length} items
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripeAccount.requirements.currently_due.slice(0, 3).join(", ")}
                    {stripeAccount.requirements.currently_due.length > 3 ? "..." : ""}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <ApprovalSection
        doctorId={doctor.id}
        gmcNumber={doctor.gmc_number}
        website={doctor.website}
        verificationStatus={doctor.verification_status}
        isActive={doctor.is_active}
        isFeatured={doctor.is_featured}
        currentPlan={currentPlan}
        checklist={checklistData}
      />

      <div className="flex items-center gap-3">
        <Link href={`/doctors/${doctor.slug}`}>
          <span className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ExternalLink className="h-4 w-4" /> View Public Profile
          </span>
        </Link>
        <SendEmailDialog
          userId={doctor.profile_id}
          userName={`Dr. ${doctor.profile.first_name} ${doctor.profile.last_name}`}
          userEmail={doctor.profile.email}
        />
      </div>
    </div>
  );
}
