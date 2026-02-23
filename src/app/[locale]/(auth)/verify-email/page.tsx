import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <Mail className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-semibold">Check Your Email</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent you a verification link. Please check your email and
          click the link to verify your account.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/login">Back to Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
