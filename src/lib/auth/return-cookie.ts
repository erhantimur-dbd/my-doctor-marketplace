import { routing } from "@/i18n/routing";

/** Cookie used to resume post-auth destinations (e.g. book URL) without
 *  stuffing long query strings into Supabase emailRedirectTo allowlists. */
export const AUTH_RETURN_COOKIE = "auth_return_to";

/** Set before doctor OAuth from /register-doctor so callback can bootstrap shell */
export const DOCTOR_OAUTH_INTENT_COOKIE = "md360_doctor_oauth";

const AUTH_LOCALES = new Set<string>(routing.locales);

/**
 * Same-origin relative path only. Query/hash allowed; protocol-relative,
 * backslash, encoded slash, and `@` userinfo tricks are rejected.
 */
export function isSafeRelativePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (/[\s\\@]/.test(path)) return false;
  if (/%(?:2f|5c|00)/i.test(path)) return false;
  return true;
}

/** Only known next-intl locales may be interpolated into redirect URLs. */
export function sanitizeAuthLocale(
  raw: string | null | undefined,
  fallback: string = routing.defaultLocale
): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (AUTH_LOCALES.has(value)) return value;
  if (AUTH_LOCALES.has(fallback)) return fallback;
  return routing.defaultLocale;
}
