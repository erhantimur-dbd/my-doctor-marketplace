"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function VerifyMfaPage() {
  const t = useTranslations("twoFactor");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Get the verified TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

      if (!verifiedTotp) {
        // No MFA factor — shouldn't be on this page
        router.replace(`/${locale}/login`);
        return;
      }

      setFactorId(verifiedTotp.id);
      setLoading(false);
    }
    init();
  }, [supabase, router, locale]);

  async function handleVerify() {
    if (!factorId || code.length !== 6) return;

    setVerifying(true);
    setError("");

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError || !challenge) {
      setError(t("error_invalid_code"));
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(t("error_invalid_code"));
      setCode("");
      setVerifying(false);
      return;
    }

    // MFA verified — session is now AAL2. Redirect to dashboard.
    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role as string | undefined;

    if (role === "doctor") {
      router.replace(`/${locale}/doctor-dashboard`);
    } else if (role === "admin") {
      router.replace(`/${locale}/admin`);
    } else {
      router.replace(`/${locale}/dashboard`);
    }
  }

  // Submit on Enter key
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && code.length === 6 && !verifying) {
      handleVerify();
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t("verify_page_title")}</CardTitle>
        <CardDescription>{t("verify_page_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">{t("enter_code")}</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(val);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            className="text-center text-xl tracking-widest font-mono"
            autoFocus
          />
        </div>

        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={code.length !== 6 || verifying}
        >
          {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("verify_button")}
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {t("back_to_login")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
