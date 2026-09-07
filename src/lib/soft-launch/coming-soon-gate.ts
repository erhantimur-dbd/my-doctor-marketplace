/**
 * Soft Launch coming-soon allowlist.
 * Keep in sync with vercel.json rewrites (authoritative on prod custom hosts)
 * and src/app/sitemap.ts SOFT_LAUNCH_PUBLIC_PAGES.
 *
 * Preview *.vercel.app does not match vercel.json hosts — middleware must
 * apply this same allowlist when VERCEL_ENV !== "production" so patient
 * marketplace routes (/doctors, specialties, …) stay dark.
 */

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
] as const;

const COMING_SOON_ROOT_ALLOWED = new Set(["/sitemap.xml", "/robots.txt"]);

const LOCALE_PATTERN = /^\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/;

export function comingSoonGateApplies(
  host: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): boolean {
  return (
    (COMING_SOON_HOSTS as readonly string[]).includes(host) ||
    vercelEnv !== "production"
  );
}

export function isAllowedOnComingSoon(pathname: string): boolean {
  if (COMING_SOON_ROOT_ALLOWED.has(pathname)) return true;
  const withoutLocale = pathname.replace(LOCALE_PATTERN, "/");
  const path =
    withoutLocale.length > 1 && withoutLocale.endsWith("/")
      ? withoutLocale.slice(0, -1)
      : withoutLocale || "/";
  return COMING_SOON_ALLOWED_PREFIXES.some((entry) => {
    if (entry === "/") return path === "/";
    if (entry.endsWith("/")) {
      return path === entry.slice(0, -1) || path.startsWith(entry);
    }
    return path === entry || path.startsWith(entry + "/");
  });
}

/** Patient marketplace / search surfaces that must stay coming-soon-dark. */
export function isPatientMarketplacePath(pathname: string): boolean {
  const withoutLocale = pathname.replace(LOCALE_PATTERN, "/") || "/";
  const path =
    withoutLocale.length > 1 && withoutLocale.endsWith("/")
      ? withoutLocale.slice(0, -1)
      : withoutLocale;
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
    path.startsWith("/blog/")
  );
}
