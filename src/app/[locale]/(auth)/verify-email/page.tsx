"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { resendVerificationEmail } from "@/actions/auth";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setResent(false);

    const result = await resendVerificationEmail(email, locale);

    if (result.error) {
      setError(result.error);
    } else {
      setResent(true);
      setCooldown(60);
    }

    setResending(false);
  }, [email, locale, cooldown, resending]);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t("verify_title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("verify_desc")}
          </p>
          {email && (
            <p className="text-sm font-semibold">{email}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("verify_check_spam")}
        </p>

        {/* Resend feedback */}
        {resent && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {t("verify_resent")}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Resend button */}
        {email && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("verify_resend")}
              </>
            ) : cooldown > 0 ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("verify_cooldown", { seconds: cooldown })}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("verify_resend")}
              </>
            )}
          </Button>
        )}

        <div className="flex w-full flex-col gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">{t("sign_in")}</Link>
          </Button>
          {email && (
            <Button variant="link" size="sm" className="text-xs text-muted-foreground" asChild>
              <Link href="/register">{t("verify_wrong_email")}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
