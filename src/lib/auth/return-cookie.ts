/** Cookie used to resume post-auth destinations (e.g. book URL) without
 *  stuffing long query strings into Supabase emailRedirectTo allowlists. */
export const AUTH_RETURN_COOKIE = "auth_return_to";

export function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}
