"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function completeMfaLogin(
  accessToken: string,
  refreshToken: string,
  locale: string,
  userRole?: string
) {
  const supabase = await createClient();
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Redirect from server side — ensures cookies are set before navigation
  if (userRole === "doctor") {
    redirect(`/${locale}/doctor-dashboard`);
  } else if (userRole === "admin") {
    redirect(`/${locale}/admin`);
  } else {
    redirect(`/${locale}/dashboard`);
  }
}
