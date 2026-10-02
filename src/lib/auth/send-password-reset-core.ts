import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { passwordResetEmail } from "@/lib/email/password-reset-email";
import { log } from "@/lib/utils/logger";

export async function deliverPasswordResetEmail(
  email: string,
  redirectTo: string
): Promise<
  { ok: true } | { ok: false; error: string; missingUser?: boolean }
> {
  const to = email.trim().toLowerCase();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: to,
    options: { redirectTo },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    const message = error?.message || "Could not create a reset link";
    const missingUser = /not found/i.test(message);
    log.error("password reset link failed", { err: error });
    return { ok: false, error: message, missingUser };
  }

  const { subject, html } = passwordResetEmail({ confirmUrl: link });
  const sent = await sendEmail({ to, subject, html });
  if (!sent.success) {
    return { ok: false, error: sent.error || "Could not send the reset email" };
  }
  return { ok: true };
}
