import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function EmailVerifiedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine if the user is a doctor or patient for the correct CTA
  let role = "patient";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile) {
      role = profile.role;
    }
  }

  const dashboardHref =
    role === "doctor"
      ? "/doctor-dashboard"
      : role === "admin"
        ? "/admin"
        : "/dashboard";

  const dashboardLabel =
    role === "doctor" ? "Go to Doctor Dashboard" : "Go to Dashboard";

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Email Verified!</h2>
          <p className="text-muted-foreground">
            Your email has been successfully verified. Your account is now
            active and ready to use.
          </p>
        </div>

        {role === "doctor" && (
          <div className="w-full rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
            <p className="text-sm text-blue-800">
              <strong>Next steps:</strong> Complete your doctor profile by
              adding your education, certifications, clinic photos, and
              availability schedule. Your profile will be reviewed by our
              team before it goes live.
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          {user ? (
            <Button className="w-full" asChild>
              <Link href={dashboardHref}>
                {dashboardLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button className="w-full" asChild>
              <Link href="/login">
                Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}

          <Button variant="ghost" className="w-full" asChild>
            <Link href="/doctors">Browse Doctors</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
