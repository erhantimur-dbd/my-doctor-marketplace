"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, CalendarCheck, Stethoscope } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  login,
  register,
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
  signInWithAzure,
  signInWithTwitter,
} from "@/actions/auth";

/* ── SVG icons (inline to avoid extra deps) ── */

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 13h10v10H1z" />
      <path fill="#7fba00" d="M13 1h10v10H13z" />
      <path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── AuthPage ── */

interface AuthPageProps {
  defaultTab: "sign-up" | "sign-in";
}

export function AuthPage({ defaultTab }: AuthPageProps) {
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
  const isBookingRedirect =
    redirectTo.includes("/booking") || redirectTo.includes("/dashboard");
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

  return (
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
          {/* ── Booking context banner ── */}
          {isBookingRedirect && (
            <div className="mb-5 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                {activeTab === "sign-up"
                  ? t("booking_banner_sign_up")
                  : t("booking_banner_sign_in")}
              </p>
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

          {/* ── Social login (shared) ── */}
          <div className="space-y-3">
            <form
              action={async () => {
                const result = await signInWithGoogle(locale, redirectTo || undefined);
                if (result?.error) setError(result.error);
              }}
            >
              <Button variant="outline" className="h-11 w-full" type="submit">
                <GoogleIcon />
                {t("continue_with_google")}
              </Button>
            </form>

            <form
              action={async () => {
                const result = await signInWithApple(locale, redirectTo || undefined);
                if (result?.error) setError(result.error);
              }}
            >
              <Button variant="outline" className="h-11 w-full" type="submit">
                <AppleIcon />
                {t("continue_with_apple")}
              </Button>
            </form>

            <form
              action={async () => {
                const result = await signInWithFacebook(locale, redirectTo || undefined);
                if (result?.error) setError(result.error);
              }}
            >
              <Button variant="outline" className="h-11 w-full" type="submit">
                <FacebookIcon />
                {t("continue_with_facebook")}
              </Button>
            </form>

            <form
              action={async () => {
                const result = await signInWithAzure(locale, redirectTo || undefined);
                if (result?.error) setError(result.error);
              }}
            >
              <Button variant="outline" className="h-11 w-full" type="submit">
                <MicrosoftIcon />
                {t("continue_with_microsoft")}
              </Button>
            </form>

            <form
              action={async () => {
                const result = await signInWithTwitter(locale, redirectTo || undefined);
                if (result?.error) setError(result.error);
              }}
            >
              <Button variant="outline" className="h-11 w-full" type="submit">
                <XIcon />
                {t("continue_with_x")}
              </Button>
            </form>
          </div>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {t("or_continue_with")}
            </span>
            <Separator className="flex-1" />
          </div>

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
  );
}
