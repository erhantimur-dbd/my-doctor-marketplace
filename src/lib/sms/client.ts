/**
 * Twilio SMS client — sends SMS messages via Twilio REST API.
 * Falls back to console logging when env vars are not set (dev mode).
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  (e.g. "+447123456789")
 */

import { log } from "@/lib/utils/logger";

interface SendSmsParams {
  to: string;   // E.164 format (e.g. "+447700900000")
  body: string;  // Max 1600 chars (concatenated SMS)
}

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format a phone number for Twilio.
 * Ensures E.164 format: starts with +, digits only, 7-15 digits.
 * Returns null if invalid.
 */
export function formatPhoneForSms(phone: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d+]/g, "");

  // Ensure leading +
  if (!cleaned.startsWith("+")) {
    // Assume it's missing the +
    cleaned = `+${cleaned}`;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  return cleaned;
}

/**
 * Check if Twilio SMS is configured
 */
export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

/**
 * Send an SMS via Twilio
 */
export async function sendSms({ to, body }: SendSmsParams): Promise<SmsResult> {
  const formattedPhone = formatPhoneForSms(to);
  if (!formattedPhone) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!isSmsConfigured()) {
    log.info("[SMS] (dev) Would send to", {
      to: formattedPhone,
      body: body.substring(0, 100),
    });
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const twilio = await import("twilio");
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const message = await client.messages.create({
      to: formattedPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body,
    });

    log.info("[SMS] Sent", {
      to: formattedPhone,
      sid: message.sid,
      status: message.status,
    });

    return { success: true, messageId: message.sid };
  } catch (err) {
    log.error("[SMS] Send failed", { err, to: formattedPhone });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
