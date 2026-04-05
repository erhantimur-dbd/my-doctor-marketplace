"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
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

type MfaState = "loading" | "disabled" | "enabled";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function TwoFactorSection({ showRecommendation = false }: { showRecommendation?: boolean }) {
  const t = useTranslations("twoFactor");
  const supabase = createClient();

  const [mfaState, setMfaState] = useState<MfaState>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

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
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
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
    });
    setEnrollDialogOpen(true);
  }

  async function verifyEnrollment() {
    if (!enrollData || enrollCode.length !== 6) return;

    setEnrolling(true);
    setEnrollError("");

    // Use fetch directly to avoid the Supabase client's internal session save
    // which hangs due to NavigatorLock contention with @supabase/ssr cookie storage.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    // Step 1: Create challenge via REST
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setEnrollError("Session expired. Please log in again.");
      setEnrolling(false);
      return;
    }

    const challengeRes = await fetch(
      `${supabaseUrl}/auth/v1/factors/${enrollData.factorId}/challenge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      }
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
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
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setDisableError("Session expired. Please log in again.");
      setDisabling(false);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
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
              <Label htmlFor="enroll-code">{t("enter_code")}</Label>
              <Input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={enrollCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setEnrollCode(val);
                  setEnrollError("");
                }}
                className="text-center text-lg tracking-widest font-mono"
                autoFocus
              />
              {enrollError && (
                <p className="text-sm text-destructive flex items-center gap-1">
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
            <Label htmlFor="disable-code">{t("enter_code")}</Label>
            <Input
              id="disable-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setDisableCode(val);
                setDisableError("");
              }}
              className="text-center text-lg tracking-widest font-mono"
              autoFocus
            />
            {disableError && (
              <p className="text-sm text-destructive flex items-center gap-1">
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
