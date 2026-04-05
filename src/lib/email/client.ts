import { Resend } from "resend";
import { log } from "@/lib/utils/logger";
import { createAdminClient } from "@/lib/supabase/admin";

// Lazy-initialise so the missing API key doesn't crash the build.
// When RESEND_API_KEY is absent the sendEmail function falls back
// to a console log (dev / preview mode).
let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResend();

  if (!resend) {
    console.log(`[Email] Would send to ${to}: ${subject}`);
    return { success: true };
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "MyDoctors360 <noreply@mydoctors360.com>",
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    log.error("[Email] Failed to send:", { err: error });
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export async function checkMarketingConsent(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cookie_consents")
      .select("marketing")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return false;
    return data.marketing === true;
  } catch {
    return false;
  }
}

export async function sendMarketingEmail({
  to,
  userId,
  subject,
  html,
}: {
  to: string;
  userId: string;
  subject: string;
  html: string;
}) {
  const hasConsent = await checkMarketingConsent(userId);
  if (!hasConsent) {
    console.log(`[Email] Skipping marketing email to ${to}: no consent`);
    return { success: false, error: "No marketing consent" };
  }
  return sendEmail({ to, subject, html });
}
