"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, Stethoscope, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  PasswordStrength,
  passwordMeetsServerMinimum,
} from "@/components/ui/password-strength";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [loginEmail, setLoginEmail] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState<
    string | null
  >(null);

  // Smart default: show sign-up when coming from a booking redirect
  const isBookingRedirect = isBookRedirect(redirectTo) || !!bookingContext;
  const smartDefault =
    defaultTab === "sign-in" && isBookingRedirect ? "sign-up" : defaultTab;

  const [activeTab, setActiveTab] = useState<string>(smartDefault);

  const registerPasswordOk = passwordMeetsServerMinimum(passwordValue);

  /* ── Handlers ── */

  async function handleLogin(formData: FormData) {
    setLoginLoading(true);
    setError("");
    setNeedsVerificationEmail(null);
    formData.append("redirect", redirectTo);
    formData.append("locale", locale);
    // Prefer controlled email if present
    if (loginEmail) formData.set("email", loginEmail);

    const result = await login(formData);
    if (result && "mfaRequired" in result && result.mfaRequired) {
      router.push(`/${locale}/verify-mfa`);
      return;
    }
    if (result && "needsVerification" in result && result.needsVerification) {
      const em =
        ("email" in result && typeof result.email === "string"
          ? result.email
          : loginEmail) || "";
      setNeedsVerificationEmail(em);
      setError(
        result.error ||
          "Please verify your email address before signing in."
      );
      setLoginLoading(false);
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
    setNeedsVerificationEmail(null);

    if (!acceptedTerms) {
      setError(
        t("accept_terms_required") ||
          "Please accept the Terms of Service and Privacy Policy to continue."
      );
      setRegisterLoading(false);
      return;
    }
    if (!registerPasswordOk) {
      setError(
        t("password_requirements") ||
          "Password must be at least 8 characters and include 3 of: lowercase, uppercase, number, symbol."
      );
      setRegisterLoading(false);
      return;
    }

    formData.append("redirect", redirectTo);
    formData.append("locale", locale);
    formData.set("accepted", "true");
    if (registerEmail) formData.set("email", registerEmail);

    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
      setRegisterLoading(false);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    setError("");
    setNeedsVerificationEmail(null);
    // Update URL without full navigation so bookmarks / back button work
    const newPath = value === "sign-in" ? `/${locale}/login` : `/${locale}/register`;
    // Preserve redirect param
    const url = redirectTo
      ? `${newPath}?redirect=${encodeURIComponent(redirectTo)}`
      : newPath;
    router.replace(url, { scroll: false });
  }

  const summaryMode = activeTab === "sign-up" ? "sign-up" : "sign-in";
  const verifyHref = needsVerificationEmail
    ? `/verify-email?email=${encodeURIComponent(needsVerificationEmail)}${
        redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""
      }`
    : "/verify-email";

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
              {t("callback_error") ||
                "Email verification failed or link expired. Please try signing up again or resend the verification email."}
            </div>
          )}
          {error && (
            <div className="mb-4 space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              {needsVerificationEmail && (
                <Button variant="outline" size="sm" className="w-full bg-background" asChild>
                  <Link href={verifyHref}>
                    <Mail className="mr-2 h-4 w-4" />
                    {t("go_to_verify_email") || "Open email verification"}
                  </Link>
                </Button>
              )}
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
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
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

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="accept-terms"
                  className="text-xs font-normal leading-relaxed text-muted-foreground"
                >
                  {t("signup_terms_prefix") || "I agree to the"}{" "}
                  <Link
                    href="/terms"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                  >
                    {t("terms_link") || "Terms of Service"}
                  </Link>{" "}
                  {t("and") || "and"}{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                  >
                    {t("privacy_link") || "Privacy Policy"}
                  </Link>
                  .
                </Label>
              </div>

              <input type="hidden" name="locale" value={locale} />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  registerLoading ||
                  !acceptedTerms ||
                  (passwordValue.length > 0 && !registerPasswordOk)
                }
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
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
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
