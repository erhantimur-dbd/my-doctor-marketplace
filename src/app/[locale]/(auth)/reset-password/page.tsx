"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  PasswordStrength,
  passwordMeetsServerMinimum,
} from "@/components/ui/password-strength";
import { resetPassword } from "@/actions/auth";
import { useState } from "react";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

/**
 * Set / reset password after Supabase recovery link (guest claim or forgot-password).
 * Session is established via /callback?type=recovery before landing here.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    if (!passwordMeetsServerMinimum(password)) {
      setError(
        t("password_requirements") ||
          "Password must be at least 8 characters and include 3 of: lowercase, uppercase, number, symbol."
      );
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError(t("passwords_mismatch") || "Passwords do not match.");
      setLoading(false);
      return;
    }
    formData.set("password", password);
    formData.set("locale", locale);
    try {
      const result = await resetPassword(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // redirect() throws; if we return, show success
      setSuccess(true);
    } catch {
      // next/navigation redirect throws — treat as success path
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <h2 className="text-xl font-semibold">
            {t("password_updated_title") || "Password updated"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("password_updated_body") ||
              "Your password has been updated. You can sign in now."}
          </p>
          <Button asChild>
            <Link href="/login">{t("sign_in")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("set_password")}</CardTitle>
        <CardDescription>
          {t("set_password_subtitle") ||
            "Choose a strong password to manage bookings and your MyDoctors360 account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{t("new_password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordStrength password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">{t("confirm_password")}</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <input type="hidden" name="locale" value={locale} />

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !passwordMeetsServerMinimum(password) ||
              password !== confirm
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("set_password")}
          </Button>

          <Button variant="ghost" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("sign_in")}
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
