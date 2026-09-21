/**
 * Soft Launch coming-soon allowlist.
 * Keep in sync with vercel.json rewrites (authoritative on prod custom hosts)
 * and src/app/sitemap.ts SOFT_LAUNCH_PUBLIC_PAGES.
 *
 * Preview *.vercel.app does not match vercel.json hosts. While
 * SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME is on, middleware applies this
 * allowlist on every host so /en/doctors stays coming-soon-dark (not a live
 * directory). Do not key the Preview gate on VERCEL_ENV — Edge inlines it.
 */

import { SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME } from "@/lib/constants/company";

export const COMING_SOON_HOSTS = [
  "mydoctors360.com",
  "www.mydoctors360.com",
  "mydoctors360.co.uk",
  "www.mydoctors360.co.uk",
  "mydoctors360.eu",
  "www.mydoctors360.eu",
] as const;

export const COMING_SOON_ALLOWED_PREFIXES = [
  // Soft-launch: patient home/search stay gated. Coming-soon is the public face.
  // Auth flow
  "/login",
  "/register",
  // Authenticated Soft Launch Soft CTA patient surfaces (bookings, video-room).
  // Marketplace chrome stays dark — do not add /doctors, /specialties, /find.
  // Book deep-link `/doctors/:slug/book` is a path matcher, not a prefix.
  "/dashboard",
  "/verify-email",
  "/verify-mfa",
  "/forgot-password",
  "/reset-password",
  "/email-verified",
  "/callback",
  "/accept-terms",
  // Doctor onboarding
  "/register-doctor",
  "/register-testing-service",
  "/doctor-dashboard",
  "/doctor-dashboard/",
  // Doctor-facing marketing
  "/pricing",
  "/how-it-works",
  "/how-it-works/",
  "/contact",
  "/support",
  "/help-center",
  "/help-center/",
  // Legal pages linked from auth/registration flows
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/about",
  // UK regulatory and complaints pages (serve 200 on .co.uk, 404 on other
  // regions — the page.tsx decides). Listed here so the coming-soon gate
  // doesn't swallow them before the page-level region check runs.
  "/regulatory",
  "/complaints",
  // Invite / invitation deep links (clinic seat + doctor invites)
  "/invite",
  "/invitation",
  // Public survey pages
  "/survey",
  // Admin command centre — allowlisted admins only (RBAC enforced below)
  "/admin",
  // Do not use `as const` here — Next build typecheck fails TS2367 when
  // the matcher compares entry to "/" (Vercel Preview dpl_H9zqKH5L5CKYoLwQmQtNNCUv5kny).
] as readonly string[];

const COMING_SOON_ROOT_ALLOWED = new Set(["/sitemap.xml", "/robots.txt"]);

const LOCALE_PATTERN = /^\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/;

/** `/[locale]/doctors/:slug/book` only — listing and profile stay gated. */
const COMING_SOON_BOOK_DEEP_LINK = /^\/doctors\/[^/]+\/book$/;

export function normalizeComingSoonPath(pathname: string): string {
  const noQuery = pathname.split("?")[0] ?? pathname;
  const withoutLocale = noQuery.replace(LOCALE_PATTERN, "/");
  return withoutLocale.length > 1 && withoutLocale.endsWith("/")
    ? withoutLocale.slice(0, -1)
    : withoutLocale || "/";
}

/** Soft Launch Soft CTA book entry: `/doctors/:slug/book` (+ trailing slash). */
export function isComingSoonBookDeepLink(pathname: string): boolean {
  return COMING_SOON_BOOK_DEEP_LINK.test(normalizeComingSoonPath(pathname));
}

export function comingSoonGateApplies(
  host: string,
  _vercelEnv?: string
): boolean {
  if (SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME) return true;
  return (COMING_SOON_HOSTS as readonly string[]).includes(host);
}

export function isAllowedOnComingSoon(pathname: string): boolean {
  if (COMING_SOON_ROOT_ALLOWED.has(pathname)) return true;
  const path = normalizeComingSoonPath(pathname);
  if (COMING_SOON_BOOK_DEEP_LINK.test(path)) return true;
  return COMING_SOON_ALLOWED_PREFIXES.some((entry) => {
    if (entry.endsWith("/")) {
      return path === entry.slice(0, -1) || path.startsWith(entry);
    }
    return path === entry || path.startsWith(entry + "/");
  });
}

/** Patient marketplace / search surfaces that must stay coming-soon-dark. */
export function isPatientMarketplacePath(pathname: string): boolean {
  const path = normalizeComingSoonPath(pathname);
  return (
    path === "/doctors" ||
    path.startsWith("/doctors/") ||
    path === "/specialties" ||
    path.startsWith("/specialties/") ||
    path === "/conditions" ||
    path.startsWith("/conditions/") ||
    path === "/find" ||
    path.startsWith("/find/") ||
    path === "/blog" ||
    path.startsWith("/blog/") ||
    path === "/clinics" ||
    path.startsWith("/clinics/") ||
    path === "/rewards" ||
    path.startsWith("/rewards/") ||
    path === "/find-pharmacy" ||
    path.startsWith("/find-pharmacy/")
  );
}
