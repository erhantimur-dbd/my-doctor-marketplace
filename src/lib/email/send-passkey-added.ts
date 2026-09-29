import { sendEmail } from "@/lib/email/client";
import {
  SECURITY_EMAIL_FROM,
  passkeyAddedEmail,
  type PasskeyAddedEmailParams,
} from "@/lib/email/security-templates";

/**
 * Send the Tesla-style "You Have Added A Passkey" security notice.
 * Call after a passkey / WebAuthn credential is successfully enrolled.
 */
export async function sendPasskeyAddedNotification({
  to,
  settingsUrl,
  supportUrl,
}: {
  to: string;
} & PasskeyAddedEmailParams) {
  const { subject, html } = passkeyAddedEmail({ settingsUrl, supportUrl });
  return sendEmail({
    to,
    subject,
    html,
    from: SECURITY_EMAIL_FROM,
  });
}
