import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const protectedPatientRoutes = ["/dashboard"];
const protectedDoctorRoutes = ["/doctor-dashboard"];
const protectedAdminRoutes = ["/admin"];

function getPathnameWithoutLocale(pathname: string): string {
  const localePattern = /^\/(en|de|tr|fr|it|es|pt)(\/|$)/;
  return pathname.replace(localePattern, "/");
}

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(en|de|tr|fr|it|es|pt)(\/|$)/);
  return match ? match[1] : "en";
}

export async function middleware(request: NextRequest) {
  // Run intl middleware first
  const intlResponse = intlMiddleware(request);

  // Update Supabase session
  const { user } = await updateSession(request, intlResponse);

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

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
