import { Resend } from "resend";

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
      from: process.env.EMAIL_FROM || "MyDoctor <noreply@mydoctor.com>",
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false, error };
  }
}
