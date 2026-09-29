import { isSafeRelativePath } from "@/lib/auth/return-cookie";

export function dashboardPathForRole(
  locale: string,
  role: string | undefined | null
): string {
  if (role === "doctor") return `/${locale}/doctor-dashboard`;
  if (role === "admin") return `/${locale}/admin`;
  return `/${locale}/dashboard`;
}

/** Prefer an explicit post-auth path when it is a same-origin relative URL. */
export function resolvePostAuthPath(
  locale: string,
  role: string | undefined | null,
  redirectTo?: string | null
): string {
  if (redirectTo && isSafeRelativePath(redirectTo)) return redirectTo;
  return dashboardPathForRole(locale, role);
}
