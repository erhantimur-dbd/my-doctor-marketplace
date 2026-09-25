/**
 * Wrap a protected patient route (e.g. /doctors/slug/book) so that an
 * unauthenticated visitor is first sent to the login page with a `redirect`
 * param, then seamlessly resumes the flow after login.
 *
 * Expects a locale-less path (the next-intl `<Link>` component prefixes the
 * locale automatically). The `redirect` param IS locale-prefixed so the
 * server-side `redirect()` after login resolves directly.
 *
 * Only relative internal paths get preserved — external URLs are dropped
 * before building the redirect param, to prevent open-redirect abuse.
 */
import { isSafeRelativePath } from "@/lib/auth/return-cookie";

export function getAuthedHref(
  targetPath: string,
  options: { isAuthenticated: boolean; locale: string }
): string {
  if (options.isAuthenticated) return targetPath;
  const redirect = isSafeRelativePath(targetPath)
    ? `/${options.locale}${targetPath}`
    : `/${options.locale}`;
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}

export interface BookRedirectContext {
  locale: string;
  slug: string;
  date?: string;
  time?: string;
  type?: string;
  /** doctor_services.id when deep-linked as reason-for-visit */
  service?: string;
  /** Full relative redirect path including query (safe for post-login). */
  redirectPath: string;
}

function redirectPathname(redirectTo: string): string {
  const cut = redirectTo.search(/[?#]/);
  return cut === -1 ? redirectTo : redirectTo.slice(0, cut);
}

/**
 * True when the post-auth destination is a patient book URL.
 * Matches `/en/doctors/:slug/book` (optional query) and legacy banner paths
 * that contain booking intent.
 *
 * Staff lists such as `/en/doctor-dashboard/bookings` are not book flows.
 * `includes("/booking")` false-positives because `/bookings` contains that
 * substring. `doctor-dashboard` does not contain `/dashboard` (hyphen, not
 * slash), so the legacy dashboard+book clause is not what matches it.
 */
export function isBookRedirect(redirectTo: string | null | undefined): boolean {
  if (!redirectTo) return false;
  const pathname = redirectPathname(redirectTo);

  if (/(?:^|\/)doctor-dashboard(?:\/|$)/.test(pathname)) {
    return false;
  }

  if (pathname.includes("/doctors/") && /\/book(?:\/|$)/.test(pathname)) {
    return true;
  }

  // Legacy banners: a "/booking…" path, but not the plural list "/bookings".
  if (/\/booking(?!s)/.test(pathname)) {
    return true;
  }

  return redirectTo.includes("/dashboard") && redirectTo.includes("book");
}

export type AuthTabId = "sign-up" | "sign-in";

/**
 * Login defaults to Create Account only for a real patient book redirect.
 * A doctor-dashboard bookings redirect stays on Sign In.
 */
export function defaultAuthTabForRedirect(
  defaultTab: AuthTabId,
  redirectTo: string | null | undefined,
  hasBookingContext = false
): AuthTabId {
  const isBookingRedirect = isBookRedirect(redirectTo) || hasBookingContext;
  return defaultTab === "sign-in" && isBookingRedirect ? "sign-up" : defaultTab;
}

/**
 * Parse a relative redirect like `/en/doctors/dr-x/book?date=...&time=...&type=video`
 * into structured booking context. Returns null if not a book URL or unsafe.
 */
export function parseBookRedirect(
  redirectTo: string | null | undefined
): BookRedirectContext | null {
  if (!redirectTo) return null;
  if (!isSafeRelativePath(redirectTo)) return null;

  try {
    const url = new URL(redirectTo, "http://local.invalid");
    const match = url.pathname.match(
      /^\/([a-z]{2}(?:-[A-Z]{2})?)\/doctors\/([^/]+)\/book\/?$/
    );
    if (!match) return null;

    const locale = match[1];
    const slug = match[2];
    if (!slug || slug.includes("..")) return null;

    const date = url.searchParams.get("date") || undefined;
    const time = url.searchParams.get("time") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const service = url.searchParams.get("service") || undefined;

    return {
      locale,
      slug,
      date,
      time,
      type,
      service,
      redirectPath: redirectTo,
    };
  } catch {
    return null;
  }
}

/** Display-friendly time from ISO datetime or HH:mm. */
export function formatBookTimeParam(time: string | undefined): string | null {
  if (!time) return null;
  // ISO: 2026-07-22T13:00:00 or with Z
  if (time.includes("T")) {
    const part = time.slice(11, 16);
    return part || null;
  }
  // Already HH:mm
  if (/^\d{1,2}:\d{2}/.test(time)) {
    return time.slice(0, 5);
  }
  return time;
}
