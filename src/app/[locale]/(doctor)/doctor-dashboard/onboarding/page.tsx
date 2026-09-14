import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, CreditCard, ArrowRight } from "lucide-react";
import { getDoctorLicense } from "@/lib/license/check";
import { ConnectStripeButton } from "@/components/doctor/connect-stripe-button";
import { Link } from "@/i18n/navigation";

export default async function DoctorOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, is_founding_member, founding_member_number, verification_status"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  const license = await getDoctorLicense(supabase, doctor.id);
  const isFounding = Boolean(doctor.is_founding_member);
  const isPaid =
    !!license &&
    license.tier !== "free" &&
    ["active", "trialing", "past_due"].includes(license.status);
  const connectDone = Boolean(
    doctor.stripe_account_id && doctor.stripe_onboarding_complete
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finish setup</h1>
        <p className="text-muted-foreground">
          Connect Stripe so patients can pay you. Every doctor — including
          Founding Doctors — needs payouts before bookings go live. We still
          take 15% on each booking.
        </p>
      </div>

      {isFounding ? (
        <Card className="border-emerald-200 bg-emerald-50/80">
          <CardContent className="p-5 text-sm text-emerald-900">
            You are Founding Doctor
            {doctor.founding_member_number
              ? ` #${doctor.founding_member_number}`
              : ""}
            . No monthly licence fee for this cohort. Patients can book you once
            you are verified and Stripe payouts are connected.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Licence</CardTitle>
          <CardDescription>
            Founding Doctors use the launch cohort (not the listing-only free
            plan). Paid plans unlock extra product tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            {isPaid || isFounding ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <span>
              {isPaid
                ? `${license?.tier} licence active`
                : isFounding
                  ? "Founding Doctor programme (bookings enabled after Connect)"
                  : "Listing-only free plan — upgrade to accept bookings"}
            </span>
          </div>
          {!isPaid ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/doctor-dashboard/organization/billing">
                {isFounding ? "See paid plans" : "Upgrade"}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            2. Stripe payouts
          </CardTitle>
          <CardDescription>
            Required for every signup so we can pay you and collect the 15%
            platform fee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectDone ? (
            <p className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Stripe connected
              {doctor.stripe_payouts_enabled ? " — payouts enabled" : " — payouts pending"}
            </p>
          ) : (
            <ConnectStripeButton
              label={
                doctor.stripe_account_id
                  ? "Complete Stripe onboarding"
                  : "Connect Stripe Account"
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Verification</CardTitle>
          <CardDescription>
            You will not appear in search or take bookings until an admin
            verifies your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          {doctor.verification_status === "verified" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
          <span>
            {doctor.verification_status === "verified"
              ? "Verified — patients can find you"
              : doctor.verification_status === "rejected"
                ? "Verification unsuccessful — contact support"
                : doctor.verification_status === "under_review"
                  ? "Under review"
                  : "Pending admin approval"}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Profile & availability</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/doctor-dashboard/profile">Edit profile</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/doctor-dashboard/calendar">Set availability</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/doctor-dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
