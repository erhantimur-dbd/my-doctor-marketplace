/** Cookie used to resume post-auth destinations (e.g. book URL) without
 *  stuffing long query strings into Supabase emailRedirectTo allowlists. */
export const AUTH_RETURN_COOKIE = "auth_return_to";

/** Set before doctor OAuth from /register-doctor so callback can bootstrap shell */
export const DOCTOR_OAUTH_INTENT_COOKIE = "md360_doctor_oauth";

export function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}
