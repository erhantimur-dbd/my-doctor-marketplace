import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isClinicInviteToken } from "@/lib/clinic-invite-token";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import {
  comingSoonGateApplies,
  isAllowedOnComingSoon,
} from "@/lib/soft-launch/coming-soon-gate";
import { SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME } from "@/lib/constants/company";

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

/**
 * Existing clinic emails use /{locale}/invite/{64-hex}. Specialty landings
 * live at /invite/[specialty]. Rewrite hex tokens with a string scan —
 * do NOT add next.config rewrites() for this. Custom rewrites() are merged
 * by @sentry/nextjs (tunnelRoute: /monitoring) into the Edge routing table
 * and can crash every path with MIDDLEWARE_INVOCATION_FAILED.
 *
 * Only 64-char hex matches. Slugs like "dentistry" are left untouched.
 */
function clinicInviteAcceptPath(pathname: string): string | null {
  const parts = pathname.split("/");
  if (
    parts.length !== 4 ||
    parts[2] !== "invite" ||
    !isClinicInviteToken(parts[3] ?? "")
  ) {
    return null;
  }
  return `/${parts[1]}/invite/accept/${parts[3]}`;
}

/**
 * Copy next-intl request-override headers + cookies onto a rewrite.
 * A bare NextResponse.rewrite() drops x-middleware-request-* locale
 * headers and makes getLocale() 500 on /invite/accept/[token].
 */
function rewritePreservingIntl(
  dest: URL,
  intlResponse: NextResponse
): NextResponse {
  const rewrite = NextResponse.rewrite(dest);
  intlResponse.headers.forEach((value, key) => {
    rewrite.headers.set(key, value);
  });
  intlResponse.cookies.getAll().forEach((cookie) => {
    rewrite.cookies.set(cookie);
  });
  return rewrite;
}

export async function middleware(request: NextRequest) {
  // Serve /sitemap.xml and /robots.txt straight from the root-level metadata
  // routes (src/app/sitemap.ts, src/app/robots.ts). Without this early return,
  // next-intl rewrites them to /{locale}/sitemap.xml, which doesn't exist and
  // resolves to the localized homepage HTML — Google Search Console then
  // reports "Couldn't fetch" on the sitemap.
  const rawPathname = request.nextUrl.pathname;
  if (rawPathname === "/sitemap.xml" || rawPathname === "/robots.txt") {
    return NextResponse.next();
  }

  // Coming-soon gate — doctor-onboarding routes pass through.
  // Prod custom domains: vercel.json is authoritative (host-scoped). Preview
  // *.vercel.app does not match those hosts. While Soft Launch chrome is on,
  // apply the same allowlist on every host so /en/doctors stays dark.
  // /invite (specialty slugs + clinic 64-hex) stays allowlisted for founding promo.
  const host = request.headers.get("host")?.replace(/:\d+$/, "") || "";
  if (
    SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME ||
    comingSoonGateApplies(host)
  ) {
    if (!isAllowedOnComingSoon(request.nextUrl.pathname)) {
      return NextResponse.rewrite(
        new URL("/coming-soon/index.html", request.url)
      );
    }
    // Allowed path — fall through to normal middleware (intl + auth + RBAC).
  }

  // Run intl middleware first. Never fall back to NextResponse.next() on
  // locale routes — that skips next-intl headers and makes getLocale() 500
  // (specialty #19). updateSession must not throw; if it cannot refresh
  // cookies it returns null supabase/user and we still return intlResponse.
  const intlResponse = intlMiddleware(request);

  const { supabase, user } = await updateSession(request, intlResponse);

  const clinicAcceptPath = clinicInviteAcceptPath(request.nextUrl.pathname);
  if (clinicAcceptPath) {
    const dest = request.nextUrl.clone();
    dest.pathname = clinicAcceptPath;
    return rewritePreservingIntl(dest, intlResponse);
  }

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

  // MFA / RBAC / license checks must not throw MIDDLEWARE_INVOCATION_FAILED.
  // Preview SSO cookies can make getAuthenticatorAssuranceLevel or profile
  // reads reject; still return next-intl so /pricing and /invite stay 200.
  try {
    // MFA enforcement: if user has MFA enrolled but session is AAL1, redirect to verify-mfa
    if (user && supabase && (isPatientRoute || isDoctorRoute || isAdminRoute)) {
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
    if ((isPatientRoute || isDoctorRoute || isAdminRoute) && user && supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, terms_accepted_at")
        .eq("id", user.id)
        .single();

      const userRole = profile?.role;

      // OAuth first-time users must accept terms (email/password already stamps
      // terms at register). Do not gate legacy accounts with null terms.
      const authProvider = user.app_metadata?.provider as string | undefined;
      const isOAuthUser = Boolean(authProvider && authProvider !== "email");
      if (
        isOAuthUser &&
        !profile?.terms_accepted_at &&
        !pathnameWithoutLocale.startsWith("/accept-terms")
      ) {
        const acceptUrl = new URL(`/${locale}/accept-terms`, request.url);
        acceptUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(acceptUrl);
      }

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

      // Admin routes: must be admin AND on email allowlist.
      // Soft-launch fail-closed: in production an empty ADMIN_EMAILS deny-alls
      // so a missing env cannot open /admin to any role=admin account.
      if (isAdminRoute) {
        const isProduction =
          process.env.VERCEL_ENV === "production" ||
          process.env.NODE_ENV === "production";
        if (isProduction && ADMIN_EMAILS.length === 0) {
          return NextResponse.redirect(new URL(`/${locale}`, request.url));
        }
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
    if (isDoctorRoute && user && supabase) {
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
  } catch (error) {
    console.error("[middleware] protected-route checks failed:", error);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|coming-soon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
