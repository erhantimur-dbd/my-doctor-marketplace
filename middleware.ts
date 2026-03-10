import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const protectedPatientRoutes = ["/dashboard"];
const protectedDoctorRoutes = ["/doctor-dashboard"];
const protectedAdminRoutes = ["/admin"];

function getPathnameWithoutLocale(pathname: string): string {
  const localePattern = /^\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/;
  return pathname.replace(localePattern, "/");
}

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/);
  return match ? match[1] : "en";
}

// Admin email allowlist — only these emails can access /admin routes
// Set ADMIN_EMAILS in .env.local as comma-separated list: "you@example.com,other@example.com"
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Domains that should only serve the coming-soon page
const COMING_SOON_HOSTS = [
  "mydoctors360.com",
  "www.mydoctors360.com",
  "mydoctors360.co.uk",
  "www.mydoctors360.co.uk",
  "mydoctors360.eu",
  "www.mydoctors360.eu",
];

export async function middleware(request: NextRequest) {
  // Gate coming-soon domains — block all production routes
  const host = request.headers.get("host")?.replace(/:\d+$/, "") || "";
  if (COMING_SOON_HOSTS.includes(host)) {
    return NextResponse.rewrite(new URL("/coming-soon/index.html", request.url));
  }

  // Run intl middleware first
  const intlResponse = intlMiddleware(request);

  // Update Supabase session
  const { supabase, user } = await updateSession(request, intlResponse);

  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = getPathnameWithoutLocale(pathname);
  const locale = getLocaleFromPathname(pathname);

  // Check protected routes
  const isPatientRoute = protectedPatientRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isDoctorRoute = protectedDoctorRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isAdminRoute = protectedAdminRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  if ((isPatientRoute || isDoctorRoute || isAdminRoute) && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Block unverified-email users from protected routes
  if (user && !user.email_confirmed_at) {
    if (isPatientRoute || isDoctorRoute || isAdminRoute) {
      const verifyUrl = new URL(`/${locale}/verify-email`, request.url);
      if (user.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      return NextResponse.redirect(verifyUrl);
    }
  }

  // MFA enforcement: if user has MFA enrolled but session is AAL1, redirect to verify-mfa
  if (user && (isPatientRoute || isDoctorRoute || isAdminRoute)) {
    const isMfaPage = pathnameWithoutLocale.startsWith("/verify-mfa");
    if (!isMfaPage) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
        return NextResponse.redirect(
          new URL(`/${locale}/verify-mfa`, request.url)
        );
      }
    }
  }

  // Role-based access control: enforce role boundaries for all protected routes
  if ((isPatientRoute || isDoctorRoute || isAdminRoute) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role;

    // Patient routes: only accessible by patients
    if (isPatientRoute && userRole !== "patient") {
      if (userRole === "doctor") {
        return NextResponse.redirect(
          new URL(`/${locale}/doctor-dashboard`, request.url)
        );
      }
      if (userRole === "admin") {
        return NextResponse.redirect(
          new URL(`/${locale}/admin`, request.url)
        );
      }
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    // Doctor routes: only accessible by doctors
    if (isDoctorRoute && userRole !== "doctor") {
      if (userRole === "patient") {
        return NextResponse.redirect(
          new URL(`/${locale}/dashboard`, request.url)
        );
      }
      if (userRole === "admin") {
        return NextResponse.redirect(
          new URL(`/${locale}/admin`, request.url)
        );
      }
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    // Admin routes: must be admin AND on email allowlist
    if (isAdminRoute) {
      if (
        ADMIN_EMAILS.length > 0 &&
        !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
      ) {
        return NextResponse.redirect(new URL(`/${locale}`, request.url));
      }
      if (userRole !== "admin") {
        return NextResponse.redirect(new URL(`/${locale}`, request.url));
      }
    }
  }

  // License enforcement: redirect suspended orgs to billing page
  if (isDoctorRoute && user) {
    const billingPages = [
      "/doctor-dashboard/organization/billing",
      "/doctor-dashboard/subscription",
    ];
    const isBillingPage = billingPages.some((p) =>
      pathnameWithoutLocale.startsWith(p)
    );

    if (!isBillingPage) {
      const { data: doctor } = await supabase
        .from("doctors")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (doctor?.organization_id) {
        const { data: license } = await supabase
          .from("licenses")
          .select("status")
          .eq("organization_id", doctor.organization_id)
          .eq("status", "suspended")
          .limit(1)
          .maybeSingle();

        if (license) {
          return NextResponse.redirect(
            new URL(
              `/${locale}/doctor-dashboard/organization/billing`,
              request.url
            )
          );
        }
      }
    }
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|coming-soon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
