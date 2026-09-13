import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Stethoscope } from "lucide-react";
import { FOUNDING_REGISTER_HREF } from "@/lib/constants/company";

export const metadata = {
  title: "Patient registration opens at launch | MyDoctors360",
  description:
    "Patient accounts open at public launch. Doctors can join the Founding Doctor Programme now.",
};

/**
 * Soft Launch: patient Create Account is dark. Keep /register-doctor live.
 * Preview and production must not show a live patient marketplace signup.
 */
export default function RegisterPage() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Patient registration opens at launch
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          MyDoctors360 is in Soft Launch for founding doctors. Patient accounts
          and booking are not open yet.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Doctors can join the Founding Doctor Programme now — register, build
          your profile, go live with us.
        </p>
        <Button className="mt-6 w-full rounded-full" asChild>
          <Link href={FOUNDING_REGISTER_HREF}>
            Join the Founding Doctor Programme{" "}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
