import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared admin page gate — auth + role check for server components.
 * Redirects unauthenticated users to login and non-admins home.
 */
export async function requireAdminPage(): Promise<{
  supabase: SupabaseClient;
  user: User;
  profile: {
    role: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/en");

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
