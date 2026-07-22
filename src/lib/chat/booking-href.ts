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
export function getAuthedHref(
  targetPath: string,
  options: { isAuthenticated: boolean; locale: string }
): string {
  if (options.isAuthenticated) return targetPath;
  const safe = targetPath.startsWith("/") && !targetPath.startsWith("//");
  const redirect = safe
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
  /** Full relative redirect path including query (safe for post-login). */
  redirectPath: string;
}

/**
 * True when the post-auth destination is a doctor booking URL.
 * Matches `/en/doctors/slug/book` and legacy paths that contain booking intent.
 */
export function isBookRedirect(redirectTo: string | null | undefined): boolean {
  if (!redirectTo) return false;
  if (redirectTo.includes("/doctors/") && redirectTo.includes("/book")) {
    return true;
  }
  // Legacy / soft matches used by older banners
  return (
    redirectTo.includes("/booking") ||
    (redirectTo.includes("/dashboard") && redirectTo.includes("book"))
  );
}

/**
 * Parse a relative redirect like `/en/doctors/dr-x/book?date=...&time=...&type=video`
 * into structured booking context. Returns null if not a book URL or unsafe.
 */
export function parseBookRedirect(
  redirectTo: string | null | undefined
): BookRedirectContext | null {
  if (!redirectTo) return null;
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return null;

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

    return {
      locale,
      slug,
      date,
      time,
      type,
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
