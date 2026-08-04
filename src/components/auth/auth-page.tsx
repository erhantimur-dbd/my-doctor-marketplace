"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookingAuthSummary } from "@/components/auth/booking-auth-summary";
import { isBookRedirect } from "@/lib/chat/booking-href";
import type { BookingAuthContext } from "@/lib/auth/booking-context";

import { login, register } from "@/actions/auth";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

/* ── AuthPage ── */

interface AuthPageProps {
  defaultTab: "sign-up" | "sign-in";
  /** Server-loaded doctor + slot context when redirect is a book URL */
  bookingContext?: BookingAuthContext | null;
}

export function AuthPage({ defaultTab, bookingContext = null }: AuthPageProps) {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";
  const verified = searchParams.get("verified") === "true";
  const callbackError = searchParams.get("error") === "auth_callback_error";
  const locale = useLocale();
  const router = useRouter();

  // Shared state
  const [error, setError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  // Smart default: show sign-up when coming from a booking redirect
  const isBookingRedirect = isBookRedirect(redirectTo) || !!bookingContext;
  const smartDefault =
    defaultTab === "sign-in" && isBookingRedirect ? "sign-up" : defaultTab;

  const [activeTab, setActiveTab] = useState<string>(smartDefault);

  /* ── Handlers ── */

  async function handleLogin(formData: FormData) {
    setLoginLoading(true);
    setError("");
    formData.append("redirect", redirectTo);
    formData.append("locale", locale);
    const result = await login(formData);
    if (result && "mfaRequired" in result && result.mfaRequired) {
      router.push(`/${locale}/verify-mfa`);
      return;
    }
    if (result?.error) {
      setError(result.error);
      setLoginLoading(false);
    }
  }

  async function handleRegister(formData: FormData) {
    setRegisterLoading(true);
    setError("");
    formData.append("redirect", redirectTo);
    formData.append("locale", locale);
    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
      setRegisterLoading(false);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    setError("");
    // Update URL without full navigation so bookmarks / back button work
    const newPath = value === "sign-in" ? `/${locale}/login` : `/${locale}/register`;
    // Preserve redirect param
    const url = redirectTo
      ? `${newPath}?redirect=${encodeURIComponent(redirectTo)}`
      : newPath;
    router.replace(url, { scroll: false });
  }

  const summaryMode = activeTab === "sign-up" ? "sign-up" : "sign-in";

  return (
    <div
      className={
        bookingContext
          ? "grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-8"
          : "mx-auto w-full max-w-md"
      }
    >
      {bookingContext && (
        <BookingAuthSummary
          context={bookingContext}
          mode={summaryMode}
          className="md:sticky md:top-8 md:mb-0"
        />
      )}

    <Card className="overflow-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* ── Tab triggers ── */}
        <TabsList className="w-full rounded-none border-b bg-muted/50 p-0 h-12">
          <TabsTrigger
            value="sign-up"
            className="flex-1 rounded-none h-full text-sm font-semibold data-[state=active]:shadow-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            {t("tab_sign_up")}
          </TabsTrigger>
          <TabsTrigger
            value="sign-in"
            className="flex-1 rounded-none h-full text-sm font-semibold data-[state=active]:shadow-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            {t("tab_sign_in")}
          </TabsTrigger>
        </TabsList>

        <CardContent className="pt-6">
          {/* Fallback banner when we detect book intent but doctor failed to load */}
          {isBookingRedirect && !bookingContext && (
            <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
              {activeTab === "sign-up"
                ? t("booking_banner_sign_up")
                : t("booking_banner_sign_in")}
            </div>
          )}

          {/* ── Status messages ── */}
          {verified && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
              {t("email_verified_success") || "Email verified successfully! You can now sign in."}
            </div>
          )}
          {callbackError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Email verification failed or link expired. Please try signing up again.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ── Social login (enabled providers only) ── */}
          <OAuthButtons
            locale={locale}
            redirectTo={redirectTo || undefined}
            onError={setError}
          />

          {/* ── Sign Up form ── */}
          <TabsContent value="sign-up" className="mt-0">
            <form action={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-first-name">{t("first_name")}</Label>
                  <Input
                    id="reg-first-name"
                    name="first_name"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-last-name">{t("last_name")}</Label>
                  <Input
                    id="reg-last-name"
                    name="last_name"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">{t("email")}</Label>
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">{t("password")}</Label>
                <PasswordInput
                  id="reg-password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  onChange={(e) => setPasswordValue(e.target.value)}
                />
                <PasswordStrength password={passwordValue} />
              </div>

              <input type="hidden" name="locale" value={locale} />

              <Button
                type="submit"
                className="w-full"
                disabled={registerLoading}
              >
                {registerLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("create_account")}
              </Button>
            </form>
          </TabsContent>

          {/* ── Sign In form ── */}
          <TabsContent value="sign-in" className="mt-0">
            <form action={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("email")}</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">{t("password")}</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    {t("forgot_password")}
                  </Link>
                </div>
                <PasswordInput
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginLoading}
              >
                {loginLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("sign_in")}
              </Button>
            </form>
          </TabsContent>
        </CardContent>

        {/* ── Footer ── */}
        <CardFooter className="justify-center border-t bg-muted/30 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Stethoscope className="h-4 w-4" />
            {t("doctor_cta")}{" "}
            <Link
              href="/register-doctor"
              className="font-medium text-primary hover:underline"
            >
              {t("doctor_cta_link")}
            </Link>
          </p>
        </CardFooter>
      </Tabs>
    </Card>
    </div>
  );
}
