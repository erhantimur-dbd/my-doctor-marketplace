"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendPasskeyAddedNotification } from "@/lib/email/send-passkey-added";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/utils/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Send the Tesla-style "You Have Added A Passkey" email after successful
 * client-side registration. Email comes from the authenticated session only.
 */
export async function notifyPasskeyAdded(input?: {
  /** Locale-prefixed settings path, e.g. /en/dashboard/settings */
  settingsPath?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Not authenticated" };
  }

  const ip = await getClientIp();
  const { limited } = await rateLimit(
    `passkey-notify:${user.id}:${ip}`,
    5,
    15 * 60 * 1000
  );
  if (limited) {
    return { error: "Too many requests. Please try again later." };
  }

  const settingsPath =
    input?.settingsPath && input.settingsPath.startsWith("/")
      ? input.settingsPath
      : "/en/dashboard/settings";
  const settingsUrl = `${APP_URL}${settingsPath}`;
  const supportUrl = `${APP_URL}/en/help-center`;

  try {
    const result = await sendPasskeyAddedNotification({
      to: user.email,
      settingsUrl,
      supportUrl,
    });
    if (!result.success) {
      log.error("[Passkey] Failed to send added notification", {
        err: result.error,
        userId: user.id,
      });
      return { error: result.error || "Failed to send notification email" };
    }
    return { success: true };
  } catch (err) {
    log.error("[Passkey] notifyPasskeyAdded threw", { err, userId: user.id });
    return { error: "Failed to send notification email" };
  }
}
