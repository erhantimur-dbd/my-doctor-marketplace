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
