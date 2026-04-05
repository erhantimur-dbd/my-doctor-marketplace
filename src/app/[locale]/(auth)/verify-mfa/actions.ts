"use server";

import { createClient } from "@/lib/supabase/server";

export async function setMfaSession(accessToken: string, refreshToken: string) {
  const supabase = await createClient();
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
