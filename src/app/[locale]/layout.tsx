import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { createClient } from "@/lib/supabase/server";
import { CookieConsentBanner } from "@/components/shared/cookie-consent-banner";
import { AnalyticsScripts } from "@/components/shared/analytics-scripts";
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  // ── Fetch auth data server-side ─────────────────────────────────
  // Reading the session from cookies on the server avoids the
  // NavigatorLock contention that happens when the client-side
  // Supabase auth methods (getUser / getSession) overlap.
  let initialUser = null;
  let initialProfile = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      initialUser = user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      initialProfile = profile;
    }
  } catch {
    // Silently continue — header will show logged-out state
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0284c7" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider
            initialUser={initialUser}
            initialProfile={initialProfile}
          >
            {children}
            <Toaster position="top-right" />
            <CookieConsentBanner />
            <PwaInstallPrompt />
          </AuthProvider>
        </NextIntlClientProvider>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
