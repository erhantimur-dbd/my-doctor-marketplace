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
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { OtpInput } from "@/components/auth/otp-input";
import { completeMfaLogin } from "@/actions/mfa";
import {
  challengeAndVerifyTotp,
  mfaFailureMessage,
  unenrollMfaFactor,
} from "@/lib/auth/mfa-rest";

type MfaState = "loading" | "disabled" | "enabled";

interface TotpFactor {
  id: string;
  friendlyName?: string | null;
  status: string;
}

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
  accessToken: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

export function TwoFactorSection({
  showRecommendation = false,
}: {
  showRecommendation?: boolean;
}) {
  const t = useTranslations("twoFactor");
  const supabase = createClient();

  const [mfaState, setMfaState] = useState<MfaState>("loading");
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [enrollAsBackup, setEnrollAsBackup] = useState(false);

  // Recovery codes (shown once after generate)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<{
    remaining: number;
    total: number;
  } | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<TotpFactor | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState("");

  const checkMfaStatus = useCallback(async () => {
    try {
      const { data: sessionData } = await withTimeout(
        supabase.auth.getSession(),
        5000
      );
      if (sessionData.session?.access_token) {
        accessTokenRef.current = sessionData.session.access_token;
      }
      const { data: listed, error } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        5000
      );
      if (error) {
        console.error("MFA listFactors error:", error);
        setMfaState("disabled");
        return;
      }
      const verifiedTotps =
        listed?.totp?.filter((f) => f.status === "verified") ?? [];
      setFactors(
        verifiedTotps.map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name,
          status: f.status,
        }))
      );
      setMfaState(verifiedTotps.length > 0 ? "enabled" : "disabled");

      if (verifiedTotps.length > 0) {
        try {
          const { data: status } = await supabase.auth.mfa.recoveryCodes.getStatus();
          if (status) {
            setRecoveryStatus({
              remaining: status.remaining,
              total: status.total,
            });
          } else {
            setRecoveryStatus(null);
          }
        } catch {
          setRecoveryStatus(null);
        }
      } else {
        setRecoveryStatus(null);
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

  async function startEnrollment(asBackup: boolean) {
    setEnrollError("");
    setEnrollCode("");
    setSecretCopied(false);
    setEnrollAsBackup(asBackup);

    const { data: listed } = await supabase.auth.mfa.listFactors();
    const unverified = listed?.totp?.filter((f) => f.status !== "verified") ?? [];
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast.error(t("error_session_expired"));
      return;
    }
    accessTokenRef.current = accessToken;

    const friendlyName = asBackup ? "Backup authenticator" : "MyDoctors360";
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    if (error || !data || !("totp" in data) || !data.totp) {
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
    if (!enrollData || enrollCode.length !== 6 || busyRef.current) return;
    busyRef.current = true;
    setEnrolling(true);
    setEnrollError("");

    const result = await challengeAndVerifyTotp({
      factorId: enrollData.factorId,
      accessToken: enrollData.accessToken,
      code: enrollCode,
    });

    if (!result.ok) {
      setEnrollError(mfaFailureMessage(result.reason, t));
      setEnrolling(false);
      busyRef.current = false;
      return;
    }

    const persisted = await completeMfaLogin(
      result.accessToken,
      result.refreshToken
    );
    if (persisted.success) {
      accessTokenRef.current = result.accessToken;
    }

    if (persisted.success) {
      accessTokenRef.current = result.accessToken;
    }

    let generatedCodes: string[] | null = null;
    if (!enrollAsBackup) {
      try {
        const { data: codesData, error: codesError } =
          await supabase.auth.mfa.recoveryCodes.generate({
            friendlyName: "Backup codes",
          });
        if (!codesError && codesData?.codes?.length) {
          generatedCodes = codesData.codes;
        }
      } catch {
        // Recovery codes may be disabled on the Auth server — TOTP still works.
      }
    }

    setEnrolling(false);
    busyRef.current = false;
    setEnrollDialogOpen(false);
    setEnrollData(null);
    setEnrollCode("");
    toast.success(
      enrollAsBackup ? t("success_backup_enabled") : t("success_enabled")
    );
    if (generatedCodes) {
      setRecoveryCodes(generatedCodes);
    }
    await checkMfaStatus();
  }

  async function handleDisable() {
    if (!disableTarget || disableCode.length !== 6 || busyRef.current) return;
    busyRef.current = true;
    setDisabling(true);
    setDisableError("");

    const token = accessTokenRef.current;
    if (!token) {
      setDisableError(t("error_session_expired"));
      setDisabling(false);
      busyRef.current = false;
      return;
    }

    const verified = await challengeAndVerifyTotp({
      factorId: disableTarget.id,
      accessToken: token,
      code: disableCode,
    });

    if (!verified.ok) {
      setDisableError(mfaFailureMessage(verified.reason, t));
      setDisabling(false);
      busyRef.current = false;
      return;
    }

    accessTokenRef.current = verified.accessToken;
    await completeMfaLogin(verified.accessToken, verified.refreshToken);

    const unenrolled = await unenrollMfaFactor({
      factorId: disableTarget.id,
      accessToken: verified.accessToken,
    });

    if (!unenrolled.ok) {
      setDisableError(mfaFailureMessage(unenrolled.reason, t));
      setDisabling(false);
      busyRef.current = false;
      return;
    }

    if (factors.length <= 1) {
      try {
        await supabase.auth.mfa.recoveryCodes.unenroll();
      } catch {
        /* optional cleanup when disabling last TOTP factor */
      }
      setRecoveryStatus(null);
      setRecoveryCodes(null);
    }

    setDisabling(false);
    busyRef.current = false;
    setDisableDialogOpen(false);
    setDisableCode("");
    setDisableTarget(null);
    toast.success(
      factors.length <= 1 ? t("success_disabled") : t("success_factor_removed")
    );
    await checkMfaStatus();
  }

  function copySecret() {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  }

  function openDisable(factor: TotpFactor) {
    setDisableTarget(factor);
    setDisableCode("");
    setDisableError("");
    setDisableDialogOpen(true);
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
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t("enabled_status")}
                </span>
              </div>
              <ul className="space-y-2">
                {factors.map((factor, index) => (
                  <li
                    key={factor.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {factor.friendlyName || t("authenticator_app")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {index === 0 ? t("factor_primary") : t("factor_backup")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDisable(factor)}
                    >
                      {factors.length === 1 ? t("disable") : t("remove_factor")}
                    </Button>
                  </li>
                ))}
              </ul>
              {factors.length < 2 && (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-sm font-medium">{t("backup_title")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("backup_desc")}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => startEnrollment(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("add_backup")}
                  </Button>
                </div>
              )}

              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">{t("recovery_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("recovery_desc")}
                </p>
                {recoveryStatus ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("recovery_remaining", {
                      remaining: recoveryStatus.remaining,
                      total: recoveryStatus.total,
                    })}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("recovery_none")}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled={regenBusy}
                  onClick={async () => {
                    setRegenBusy(true);
                    try {
                      const api = recoveryStatus
                        ? supabase.auth.mfa.recoveryCodes.regenerate()
                        : supabase.auth.mfa.recoveryCodes.generate({
                            friendlyName: "Backup codes",
                          });
                      const { data, error } = await api;
                      if (error || !data?.codes?.length) {
                        toast.error(t("error_recovery_generate"));
                        return;
                      }
                      setRecoveryCodes(data.codes);
                      await checkMfaStatus();
                    } catch {
                      toast.error(t("error_recovery_generate"));
                    } finally {
                      setRegenBusy(false);
                    }
                  }}
                >
                  {regenBusy && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {recoveryStatus
                    ? t("recovery_regenerate")
                    : t("recovery_generate")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("disabled_status")}
              </span>
              <Button onClick={() => startEnrollment(false)}>{t("enable")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={enrollDialogOpen}
        onOpenChange={(open) => {
          if (!open && enrollData) {
            supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
            setEnrollData(null);
          }
          setEnrollDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {enrollAsBackup ? t("backup_enroll_title") : t("enroll_title")}
            </DialogTitle>
            <DialogDescription>{t("enroll_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {enrollData && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium">{t("scan_qr")}</p>
                <div className="rounded-lg border bg-white p-3">
                  <img
                    src={enrollData.qrCode}
                    alt=""
                    className="h-48 w-48"
                  />
                </div>
              </div>
            )}

            {enrollData && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t("manual_key")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
                    {enrollData.secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={copySecret}
                    type="button"
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

            <div className="space-y-2">
              <Label className="block text-center">{t("enter_code")}</Label>
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
                <p className="flex items-center justify-center gap-1 text-sm text-destructive">
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

      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {factors.length <= 1 ? t("disable_title") : t("remove_factor_title")}
            </DialogTitle>
            <DialogDescription>
              {factors.length <= 1 ? t("disable_desc") : t("remove_factor_desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="block text-center">{t("enter_code")}</Label>
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
              <p className="flex items-center justify-center gap-1 text-sm text-destructive">
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
              {factors.length <= 1 ? t("confirm_disable") : t("remove_factor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!recoveryCodes}
        onOpenChange={(open) => {
          if (!open) setRecoveryCodes(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("recovery_show_title")}</DialogTitle>
            <DialogDescription>{t("recovery_show_desc")}</DialogDescription>
          </DialogHeader>
          {recoveryCodes && (
            <div className="space-y-3">
              <ul className="grid grid-cols-1 gap-1.5 rounded-md border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <li key={code}>
                    {code.match(/.{1,4}/g)?.join("-") ?? code}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(
                    recoveryCodes
                      .map((c) => c.match(/.{1,4}/g)?.join("-") ?? c)
                      .join("\n")
                  );
                  setCodesCopied(true);
                  setTimeout(() => setCodesCopied(false), 2000);
                }}
              >
                {codesCopied ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {t("recovery_copy")}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRecoveryCodes(null)}>
              {t("recovery_saved")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
