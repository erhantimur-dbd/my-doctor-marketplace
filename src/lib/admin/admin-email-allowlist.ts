/**
 * Shared admin email gate. Page middleware and server actions both use this.
 * A role=admin profile is not enough: production with an empty allowlist
 * denies everyone, and a configured list must contain the caller.
 */

export type AdminEmailEnv = {
  ADMIN_EMAILS?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

export function adminEmailAllowlist(env: AdminEmailEnv = process.env): string[] {
  return (env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isProductionAdminEnv(env: AdminEmailEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

/**
 * Null means the email gate passed and the caller may be checked for role.
 * Any string is a denial. Production with no ADMIN_EMAILS is deny-all.
 */
export function adminEmailGateError(
  email: string | null | undefined,
  env: AdminEmailEnv = process.env
): string | null {
  const allowlist = adminEmailAllowlist(env);
  if (isProductionAdminEnv(env) && allowlist.length === 0) {
    return "Not authorized";
  }
  if (
    allowlist.length > 0 &&
    !allowlist.includes((email || "").trim().toLowerCase())
  ) {
    return "Not authorized";
  }
  return null;
}
