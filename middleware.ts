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

  // Admin routes: verify role AND email allowlist at the edge
  if (isAdminRoute && user) {
    // Check email allowlist first (fast, no DB query)
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    // Check admin role in database
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|coming-soon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
