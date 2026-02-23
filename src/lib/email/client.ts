import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
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
