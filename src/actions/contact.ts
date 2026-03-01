"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";

const VALID_INQUIRY_TYPES = [
  "doctor_onboarding",
  "partnership",
  "press",
  "general",
] as const;

export async function submitContactInquiry(formData: FormData) {
  // Honeypot check — if the hidden field has a value, a bot filled it
  const honeypot = formData.get("website") as string;
  if (honeypot) {
    // Silently succeed without saving
    return { success: true };
  }

  // Extract fields
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const inquiryType = formData.get("inquiry_type") as string;
  const message = (formData.get("message") as string)?.trim();

  // Validation
  if (!name || name.length > 100) {
    return { error: "Name is required (max 100 characters)." };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }

  if (
    !inquiryType ||
    !VALID_INQUIRY_TYPES.includes(
      inquiryType as (typeof VALID_INQUIRY_TYPES)[number]
    )
  ) {
    return { error: "Please select an inquiry type." };
  }

  if (!message || message.length < 10) {
    return { error: "Message must be at least 10 characters." };
  }

  if (message.length > 2000) {
    return { error: "Message must be under 2,000 characters." };
  }

  // Store in database
  const supabase = createAdminClient();
  const { error: dbError } = await supabase
    .from("contact_inquiries")
    .insert({
      name,
      email,
      inquiry_type: inquiryType,
      message,
    });

  if (dbError) {
    console.error("[Contact] DB insert error:", dbError);
    // Don't fail the user — still send emails
  }

  // Send admin notification email
  try {
    const { contactInquiryAdminEmail } = await import(
      "@/lib/email/templates"
    );
    const { subject, html } = contactInquiryAdminEmail({
      name,
      email,
      inquiryType,
      message,
    });
    const adminEmail =
      process.env.CONTACT_ADMIN_EMAIL ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      "sales@mydoctors360.com";
    sendEmail({ to: adminEmail, subject, html }).catch((err) =>
      console.error("[Contact] Admin email error:", err)
    );
  } catch (err) {
    console.error("[Contact] Admin email template error:", err);
  }

  // Send auto-reply to sender
  try {
    const { contactInquiryAutoReplyEmail } = await import(
      "@/lib/email/templates"
    );
    const { subject, html } = contactInquiryAutoReplyEmail({
      name,
      inquiryType,
    });
    sendEmail({ to: email, subject, html }).catch((err) =>
      console.error("[Contact] Auto-reply email error:", err)
    );
  } catch (err) {
    console.error("[Contact] Auto-reply template error:", err);
  }

  return { success: true };
}
