"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { completeMfaLogin, cancelMfaLogin } from "@/actions/mfa";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { OtpInput } from "@/components/auth/otp-input";
import {
  challengeAndVerifyTotp,
  mfaFailureMessage,
} from "@/lib/auth/mfa-rest";
import { resolvePostAuthPath } from "@/lib/auth/role-redirect";
import { createClient } from "@/lib/supabase/client";

export function VerifyMfaForm({
  factors,
  accessToken,
  locale,
  userRole,
  redirectTo,
}: {
  factors: { id: string; name: string }[];
  accessToken: string;
  locale: string;
  userRole?: string;
  redirectTo?: string;
}) {
  const t = useTranslations("twoFactor");

  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const finishLogin = useCallback(
    async (access: string, refresh: string) => {
      const { success, error: persistError } = await completeMfaLogin(
        access,
        refresh
      );
      if (!success) {
        setError(
          persistError === "too_many"
            ? t("error_too_many")
            : t("error_invalid_code")
        );
        setVerifying(false);
        return false;
      }
      window.location.href = resolvePostAuthPath(locale, userRole, redirectTo);
      return true;
    },
    [locale, userRole, redirectTo, t]
  );

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || verifying || !factorId) return;

    setVerifying(true);
    setError("");

    const result = await challengeAndVerifyTotp({
      factorId,
      accessToken,
      code,
    });

    if (!result.ok) {
      setError(mfaFailureMessage(result.reason, t));
      if (result.reason === "verify") setCode("");
      setVerifying(false);
      return;
    }

    await finishLogin(result.accessToken, result.refreshToken);
  }, [factorId, accessToken, code, verifying, finishLogin, t]);

  const handleRecoveryVerify = useCallback(async () => {
    const trimmed = recoveryCode.trim();
    if (!trimmed || verifying) return;
    setVerifying(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: verifyError } =
        await supabase.auth.mfa.recoveryCodes.verify({ code: trimmed });
      if (verifyError || !data?.access_token || !data?.refresh_token) {
        setError(t("error_invalid_recovery"));
        setRecoveryCode("");
        setVerifying(false);
        return;
      }
      await finishLogin(data.access_token, data.refresh_token);
    } catch {
      setError(t("error_invalid_recovery"));
      setRecoveryCode("");
      setVerifying(false);
    }
  }, [recoveryCode, verifying, finishLogin, t]);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t("verify_page_title")}</CardTitle>
        <CardDescription>
          {mode === "totp" ? t("verify_page_desc") : t("recovery_verify_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {mode === "totp" ? (
          <>
            {factors.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="mfa-factor">{t("choose_factor")}</Label>
                <select
                  id="mfa-factor"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={factorId}
                  onChange={(e) => setFactorId(e.target.value)}
                  disabled={verifying}
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <Label className="block text-center">{t("enter_code")}</Label>
              <OtpInput
                value={code}
                onChange={(val) => {
                  setCode(val);
                  setError("");
                }}
                onComplete={handleVerify}
                disabled={verifying}
                autoFocus
                size="lg"
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
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="recovery-code">{t("recovery_code_label")}</Label>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(e) => {
                  setRecoveryCode(e.target.value);
                  setError("");
                }}
                autoComplete="one-time-code"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                disabled={verifying}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRecoveryVerify();
                }}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleRecoveryVerify}
              disabled={!recoveryCode.trim() || verifying}
            >
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("verify_button")}
            </Button>
          </>
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            disabled={verifying}
            onClick={() => {
              setMode(mode === "totp" ? "recovery" : "totp");
              setError("");
              setCode("");
              setRecoveryCode("");
            }}
          >
            {mode === "totp"
              ? t("use_recovery_code")
              : t("use_authenticator")}
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-primary"
            disabled={cancelling}
            onClick={async () => {
              setCancelling(true);
              await cancelMfaLogin(locale);
            }}
          >
            {t("back_to_login")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
