import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";

type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp";

interface WhatsAppNotification {
  to: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: "body" | "header" | "button";
    parameters: Array<{ type: "text"; text: string }>;
  }>;
}

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
  email?: { to: string; subject: string; html: string };
  whatsapp?: WhatsAppNotification;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  channels = ["in_app"],
  metadata,
  email,
  whatsapp,
}: CreateNotificationParams) {
  const supabase = createAdminClient();

  // Insert in-app notification (columns: body, data, channel per migration 00009)
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: message,
    data: metadata || {},
    channel: channels[0] || "in_app",
  });

  if (error) {
    console.error("[Notification] Failed to create:", error);
  }

  // Send email if provided
  if (email && channels.includes("email")) {
    await sendEmail(email).catch((err) =>
      console.error("[Notification] Email send failed:", err)
    );
  }

  // Send WhatsApp template if provided
  if (whatsapp && channels.includes("whatsapp")) {
    try {
      const { sendWhatsAppTemplate } = await import(
        "@/lib/whatsapp/client"
      );
      await sendWhatsAppTemplate(whatsapp);
    } catch (err) {
      console.error("[Notification] WhatsApp send failed:", err);
    }
  }

  return { success: !error };
}
