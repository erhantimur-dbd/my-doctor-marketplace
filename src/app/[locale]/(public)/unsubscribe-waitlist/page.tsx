import {
  unsubscribeByToken,
  unsubscribeSpecialtyWaitlistByToken,
} from "@/actions/availability-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; type?: string }>;
}

export default async function UnsubscribeWaitlistPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { token, type } = await searchParams;

  let success = false;
  let error: string | undefined;
  const isSpecialty = type === "specialty";

  if (token) {
    const result = isSpecialty
      ? await unsubscribeSpecialtyWaitlistByToken(token)
      : await unsubscribeByToken(token);
    success = result.success;
    error = result.error;
  } else {
    error = "Missing unsubscribe token.";
  }

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2">
            {success ? (
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <CardTitle>
            {success ? "Unsubscribed" : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {success
              ? isSpecialty
                ? "You will no longer receive alerts when specialists in this field open slots."
                : "You will no longer receive availability alerts for this doctor."
              : error || "We could not process your request."}
          </p>
          <Button asChild>
            <Link href={`/${locale}/doctors`}>Find a doctor</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
