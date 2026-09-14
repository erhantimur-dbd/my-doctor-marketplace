/**
 * Shared admin email allowlist. Production with an empty ADMIN_EMAILS
 * must deny all (fail-closed) so a missing env cannot open /admin.
 */

export function parseAdminEmails(
  raw: string | null | undefined
): string[] {
  return (raw || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminProductionEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

/**
 * Email-allowlist gate only (role check is separate).
 * Returns true when the caller must be denied.
 */
export function isAdminEmailDenied(
  email: string | null | undefined,
  options?: {
    allowlist?: string[];
    isProduction?: boolean;
  }
): boolean {
  const allowlist =
    options?.allowlist ?? parseAdminEmails(process.env.ADMIN_EMAILS);
  const isProduction = options?.isProduction ?? isAdminProductionEnv();

  if (isProduction && allowlist.length === 0) return true;
  if (allowlist.length > 0) {
    return !allowlist.includes((email || "").toLowerCase());
  }
  return false;
}
