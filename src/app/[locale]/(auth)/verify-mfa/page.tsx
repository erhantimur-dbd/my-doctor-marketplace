"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";

/* ── Individual Digit Input ── */

function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  function handleChange(index: number, char: string) {
    const sanitized = char.replace(/\D/g, "");
    if (!sanitized) return;

    const newDigits = [...digits];
    newDigits[index] = sanitized[0];
    const newValue = newDigits.join("");
    onChange(newValue);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newValue.length === 6) {
      setTimeout(onComplete, 50);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter" && value.length === 6) {
      onComplete();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
      if (pasted.length === 6) {
        setTimeout(onComplete, 50);
      }
    }
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={i === 0}
          className="h-14 w-11 sm:w-12 rounded-lg border-2 border-input bg-background text-center text-2xl font-mono font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ── Page ── */

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
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      // Cache the access token before any lock contention
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        accessTokenRef.current = sessionData.session.access_token;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

      if (!verifiedTotp) {
        router.replace(`/${locale}/login`);
        return;
      }

      setFactorId(verifiedTotp.id);
      setLoading(false);
    }
    init();
  }, [supabase, router, locale]);

  const handleVerify = useCallback(async () => {
    if (!factorId || code.length !== 6 || verifying) return;

    setVerifying(true);
    setError("");

    const token = accessTokenRef.current;
    if (!token) {
      setError("Session expired. Please log in again.");
      setVerifying(false);
      return;
    }

    // Use fetch directly to avoid NavigatorLock hang from Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };

    // Step 1: Challenge
    const challengeRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${factorId}/challenge`,
      { method: "POST", headers }
    );

    if (!challengeRes.ok) {
      setError(t("error_invalid_code"));
      setVerifying(false);
      return;
    }

    const challengeData = await challengeRes.json();

    // Step 2: Verify
    const verifyRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${factorId}/verify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          challenge_id: challengeData.id,
          code,
        }),
      }
    );

    if (!verifyRes.ok) {
      setError(t("error_invalid_code"));
      setCode("");
      setVerifying(false);
      return;
    }

    // Verification succeeded — the response contains the AAL2 session.
    // Update the Supabase client session so middleware sees AAL2.
    const verifyData = await verifyRes.json();
    if (verifyData.access_token && verifyData.refresh_token) {
      await supabase.auth.setSession({
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
      });
    }

    // Redirect to dashboard based on role
    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role as string | undefined;

    if (role === "doctor") {
      router.replace(`/${locale}/doctor-dashboard`);
    } else if (role === "admin") {
      router.replace(`/${locale}/admin`);
    } else {
      router.replace(`/${locale}/dashboard`);
    }
  }, [factorId, code, verifying, supabase, router, locale, t]);

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
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-center block">{t("enter_code")}</Label>
          <OtpInput
            value={code}
            onChange={(val) => {
              setCode(val);
              setError("");
            }}
            onComplete={handleVerify}
            disabled={verifying}
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
