import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";

type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
  email?: { to: string; subject: string; html: string };
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  channels = ["in_app"],
  metadata,
  email,
}: CreateNotificationParams) {
  const supabase = createAdminClient();

  // Insert in-app notification
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    channels,
    metadata,
  });

  if (error) {
    console.error("[Notification] Failed to create:", error);
  }

  // Send email if provided
  if (email && channels.includes("email")) {
    await sendEmail(email);
  }

  return { success: !error };
}
