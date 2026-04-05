"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeMfaLogin(
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { success: !error };
  } catch {
    return { success: false };
  }
}
