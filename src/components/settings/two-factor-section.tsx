"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

/* ── Individual Digit OTP Input ── */

function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
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
    if (index < 5) inputRefs.current[index + 1]?.focus();
    if (newValue.length === 6 && onComplete) {
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
    } else if (e.key === "Enter" && value.length === 6 && onComplete) {
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
      if (pasted.length === 6 && onComplete) setTimeout(onComplete, 50);
    }
  }

  return (
    <div className="flex justify-center gap-2">
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
          autoFocus={autoFocus && i === 0}
          className="h-12 w-10 rounded-lg border-2 border-input bg-background text-center text-xl font-mono font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

type MfaState = "loading" | "disabled" | "enabled";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
  accessToken: string;
}

export function TwoFactorSection({ showRecommendation = false }: { showRecommendation?: boolean }) {
  const t = useTranslations("twoFactor");
  const supabase = createClient();

  const [mfaState, setMfaState] = useState<MfaState>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Enrollment dialog
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);

  // Disable dialog
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState("");

  const checkMfaStatus = useCallback(async () => {
    try {
      // Race against timeout — getSession/listFactors can hang due to NavigatorLock
      const timeout = <T,>(ms: number): Promise<T> =>
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

      // Cache the access token for later use in fetch-based MFA calls
      const { data: sessionData } = await Promise.race([
        supabase.auth.getSession(),
        timeout<never>(5000),
      ]);
      if (sessionData.session?.access_token) {
        accessTokenRef.current = sessionData.session.access_token;
      }
      const { data: factors, error } = await Promise.race([
        supabase.auth.mfa.listFactors(),
        timeout<never>(5000),
      ]);
      if (error) {
        console.error("MFA listFactors error:", error);
        setMfaState("disabled");
        return;
      }
      const verifiedTotps = factors?.totp?.filter((f) => f.status === "verified") ?? [];
      if (verifiedTotps.length > 0) {
        setMfaState("enabled");
        setFactorId(verifiedTotps[0].id);
      } else {
        setMfaState("disabled");
        setFactorId(null);
      }
    } catch (err) {
      console.error("MFA check failed:", err);
      setMfaState("disabled");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  // ── Enrollment Flow ──
  async function startEnrollment() {
    setEnrollError("");
    setEnrollCode("");
    setSecretCopied(false);

    // Clean up any unverified factors first
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const unverified = factors?.totp?.filter((f) => f.status !== "verified") ?? [];
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    // Grab the access token now (before any lock contention)
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "MyDoctors360",
    });

    if (error || !data) {
      toast.error(t("error_enroll_failed"));
      return;
    }

    setEnrollData({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      accessToken,
    });
    setEnrollDialogOpen(true);
  }

  async function verifyEnrollment() {
    if (!enrollData || enrollCode.length !== 6) return;

    setEnrolling(true);
    setEnrollError("");

    // Use fetch directly to avoid the Supabase client's internal session save
    // which hangs due to NavigatorLock contention with @supabase/ssr cookie storage.
    // The access token was captured during startEnrollment() before any lock issues.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${enrollData.accessToken}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };

    // Step 1: Create challenge via REST
    const challengeRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${enrollData.factorId}/challenge`,
      { method: "POST", headers }
    );

    if (!challengeRes.ok) {
      setEnrollError(t("error_invalid_code"));
      setEnrolling(false);
      return;
    }

    const challengeData = await challengeRes.json();

    // Step 2: Verify via REST
    const verifyRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${enrollData.factorId}/verify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          challenge_id: challengeData.id,
          code: enrollCode,
        }),
      }
    );

    if (!verifyRes.ok) {
      setEnrollError(t("error_invalid_code"));
      setEnrolling(false);
      return;
    }

    setEnrolling(false);
    setEnrollDialogOpen(false);
    setEnrollData(null);
    setEnrollCode("");
    toast.success(t("success_enabled"));
    setMfaState("enabled");
    setFactorId(enrollData.factorId);
  }

  // ── Disable Flow ──
  async function handleDisable() {
    if (!factorId || disableCode.length !== 6) return;

    setDisabling(true);
    setDisableError("");

    // Use fetch directly to avoid NavigatorLock hang (same as enrollment)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const token = accessTokenRef.current;
    if (!token) {
      setDisableError("Session expired. Please log in again.");
      setDisabling(false);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };

    // Verify code to confirm identity
    const challengeRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${factorId}/challenge`,
      { method: "POST", headers }
    );

    if (!challengeRes.ok) {
      setDisableError(t("error_invalid_code"));
      setDisabling(false);
      return;
    }

    const challengeData = await challengeRes.json();

    const verifyRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${factorId}/verify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          challenge_id: challengeData.id,
          code: disableCode,
        }),
      }
    );

    if (!verifyRes.ok) {
      setDisableError(t("error_invalid_code"));
      setDisabling(false);
      return;
    }

    // Now unenroll
    const unenrollRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${factorId}`,
      { method: "DELETE", headers }
    );

    if (!unenrollRes.ok) {
      const err = await unenrollRes.json().catch(() => ({ message: "Failed to disable" }));
      setDisableError(err.message || "Failed to disable");
      setDisabling(false);
      return;
    }

    setDisabling(false);
    setDisableDialogOpen(false);
    setDisableCode("");
    toast.success(t("success_disabled"));
    setMfaState("disabled");
    setFactorId(null);
  }

  function copySecret() {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  }

  if (mfaState === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Security recommendation banner for doctors */}
      {showRecommendation && mfaState === "disabled" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t("recommendation_title")}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {t("recommendation_desc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mfaState === "enabled" ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaState === "enabled" ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t("enabled_status")}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDisableCode("");
                  setDisableError("");
                  setDisableDialogOpen(true);
                }}
              >
                {t("disable")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("disabled_status")}
              </span>
              <Button onClick={startEnrollment}>{t("enable")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={(open) => {
        if (!open && enrollData) {
          // Clean up unverified factor on close
          supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
          setEnrollData(null);
        }
        setEnrollDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("enroll_title")}</DialogTitle>
            <DialogDescription>{t("enroll_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {enrollData && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium">{t("scan_qr")}</p>
                <div className="rounded-lg border bg-white p-3">
                  {/* Supabase returns an SVG data URI */}
                  <img
                    src={enrollData.qrCode}
                    alt="2FA QR Code"
                    className="h-48 w-48"
                  />
                </div>
              </div>
            )}

            {/* Manual Secret */}
            {enrollData && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("manual_key")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1.5 text-xs font-mono break-all">
                    {enrollData.secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={copySecret}
                  >
                    {secretCopied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Code Input */}
            <div className="space-y-2">
              <Label className="text-center block">{t("enter_code")}</Label>
              <OtpInput
                value={enrollCode}
                onChange={(val) => {
                  setEnrollCode(val);
                  setEnrollError("");
                }}
                onComplete={verifyEnrollment}
                disabled={enrolling}
                autoFocus
              />
              {enrollError && (
                <p className="text-sm text-destructive flex items-center gap-1 justify-center">
                  <AlertTriangle className="h-3 w-3" />
                  {enrollError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              onClick={verifyEnrollment}
              disabled={enrollCode.length !== 6 || enrolling}
            >
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("verify_enable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("disable_title")}</DialogTitle>
            <DialogDescription>{t("disable_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-center block">{t("enter_code")}</Label>
            <OtpInput
              value={disableCode}
              onChange={(val) => {
                setDisableCode(val);
                setDisableError("");
              }}
              onComplete={handleDisable}
              disabled={disabling}
              autoFocus
            />
            {disableError && (
              <p className="text-sm text-destructive flex items-center gap-1 justify-center">
                <AlertTriangle className="h-3 w-3" />
                {disableError}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || disabling}
            >
              {disabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("confirm_disable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
