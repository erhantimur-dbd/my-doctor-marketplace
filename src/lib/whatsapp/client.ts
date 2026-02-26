// WhatsApp Cloud API client — lightweight fetch-based (no npm dependency)
// Falls back to console logging when WHATSAPP_ACCESS_TOKEN is not set

const GRAPH_API_VERSION = "v21.0";

interface SendTemplateParams {
  to: string; // Phone number with country code (e.g., "+491234567890")
  templateName: string;
  languageCode: string; // e.g., "en", "de", "tr", "fr"
  components?: TemplateComponent[];
}

interface TemplateComponent {
  type: "body" | "header" | "button";
  parameters: Array<{
    type: "text" | "currency" | "date_time";
    text?: string;
  }>;
}

interface SendTextParams {
  to: string;
  text: string;
}

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format a phone number for the WhatsApp API.
 * Strips spaces, dashes, parentheses, and the leading '+'.
 * Returns digits-only string or null if invalid.
 */
export function formatPhoneForWhatsApp(phone: string): string | null {
  if (!phone) return null;

  // Strip everything except digits and +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Remove leading +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Must have at least 7 digits (shortest valid international number)
  if (cleaned.length < 7 || cleaned.length > 15) return null;

  return cleaned;
}

/**
 * Check if WhatsApp API is configured
 */
function isConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Send a WhatsApp template message via Meta Cloud API
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
  components,
}: SendTemplateParams): Promise<WhatsAppResult> {
  const formattedPhone = formatPhoneForWhatsApp(to);
  if (!formattedPhone) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!isConfigured()) {
    console.log(
      `[WhatsApp] (dev) Would send template "${templateName}" to ${formattedPhone}`,
      { languageCode, components }
    );
    return { success: true, messageId: "dev-mode" };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0
        ? { components }
        : {}),
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] API error:", data);
      return {
        success: false,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp] Send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send a free-form text message (only works within 24-hour service window)
 * Future-proof for customer support replies
 */
export async function sendWhatsAppText({
  to,
  text,
}: SendTextParams): Promise<WhatsAppResult> {
  const formattedPhone = formatPhoneForWhatsApp(to);
  if (!formattedPhone) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!isConfigured()) {
    console.log(
      `[WhatsApp] (dev) Would send text to ${formattedPhone}: "${text.substring(0, 100)}..."`
    );
    return { success: true, messageId: "dev-mode" };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] API error:", data);
      return {
        success: false,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp] Send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
