"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { looksLikeJwt, looksLikeRefreshToken } from "@/lib/auth/session-tokens";
import { sanitizeAuthLocale } from "@/lib/auth/return-cookie";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function completeMfaLogin(
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; error?: string }> {
  const ip = await getClientIp();
  const { limited } = await rateLimit(`mfa-complete:${ip}`, 12, 15 * 60 * 1000);
  if (limited) {
    return { success: false, error: "too_many" };
  }

  if (!looksLikeJwt(accessToken) || !looksLikeRefreshToken(refreshToken)) {
    return { success: false, error: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { success: false, error: "invalid" };
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function cancelMfaLogin(locale: string = "en"): Promise<void> {
  locale = sanitizeAuthLocale(locale);
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}
