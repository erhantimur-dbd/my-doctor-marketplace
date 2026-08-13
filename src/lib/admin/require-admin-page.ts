import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeAuthLocale } from "@/lib/auth/return-cookie";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Shared admin page gate — auth + role + email allowlist for server components.
 * Redirects unauthenticated users to login and non-admins home.
 */
export async function requireAdminPage(
  localeRaw: string = "en"
): Promise<{
  supabase: SupabaseClient;
  user: User;
  profile: {
    role: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}> {
  const locale = sanitizeAuthLocale(localeRaw);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (isProduction && ADMIN_EMAILS.length === 0) {
    redirect(`/${locale}`);
  }
  if (
    ADMIN_EMAILS.length > 0 &&
    !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
  ) {
    redirect(`/${locale}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect(`/${locale}`);

  return {
    supabase,
    user,
    profile: {
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
    },
  };
}
