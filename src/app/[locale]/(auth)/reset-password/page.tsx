"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/actions/auth";
import { useState } from "react";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

/**
 * Set / reset password after Supabase recovery link (guest claim or forgot-password).
 * Session is established via /callback?type=recovery before landing here.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
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
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <h2 className="text-xl font-semibold">{t("set_password")}</h2>
          <p className="text-sm text-muted-foreground">
            Your password has been updated. You can sign in now.
          </p>
          <Button asChild>
            <Link href="/login">{t("sign_in")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("set_password")}</CardTitle>
        <CardDescription>
          Choose a password to manage bookings and your MyDoctors360 account.
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
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
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
