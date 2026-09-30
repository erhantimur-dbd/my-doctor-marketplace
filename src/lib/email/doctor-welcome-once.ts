/**
 * Doctor welcome email after a paid signup Checkout succeeds.
 * Creating or abandoning Checkout must not send it. A second success
 * event (session.completed plus subscription.updated, or a replay) must
 * not send it again.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { doctorWelcomeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/client";
import { log } from "@/lib/utils/logger";

export type DoctorWelcomeTrigger =
  | "checkout_created"
  | "payment_succeeded"
  | "checkout_expired";

export function nextDoctorWelcomeSend(input: {
  trigger: DoctorWelcomeTrigger;
  alreadySent: boolean;
}): { send: boolean; alreadySent: boolean } {
  if (input.trigger !== "payment_succeeded" || input.alreadySent) {
    return { send: false, alreadySent: input.alreadySent };
  }
  return { send: true, alreadySent: true };
}

type WelcomeProfile = { first_name?: string | null; email?: string | null };

/**
 * Claims welcome_email_sent_at in one update. Only the caller that flips
 * null → timestamp sends the message.
 */
export async function sendDoctorWelcomeOnce(
  doctorId: string
): Promise<{ sent: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("doctors")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", doctorId)
    .is("welcome_email_sent_at", null)
    .select("id, profile:profiles!doctors_profile_id_fkey(first_name, email)")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      log.error("[Welcome] doctor welcome claim failed", {
        err: error,
        doctorId,
      });
    }
    return { sent: false };
  }

  const profile = (
    Array.isArray(data.profile) ? data.profile[0] : data.profile
  ) as WelcomeProfile | null;
  const to = profile?.email?.trim();
  if (!to) return { sent: false };

  const { subject, html } = doctorWelcomeEmail({
    name: profile?.first_name?.trim() || "there",
  });
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    log.error("[Welcome] doctor welcome send failed", { err, doctorId });
  }
  return { sent: true };
}
