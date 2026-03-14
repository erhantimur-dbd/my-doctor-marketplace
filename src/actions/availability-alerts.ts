"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

/**
 * Subscribe to notifications when a doctor has new availability.
 */
export async function subscribeToAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be logged in." };

  // Verify doctor exists
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .single();

  if (!doctor) return { success: false, error: "Doctor not found." };

  // Insert alert (upsert to avoid duplicates)
  const { error } = await supabase.from("availability_alerts").upsert(
    {
      patient_id: user.id,
      doctor_id: doctorId,
      notified_at: null,
    },
    { onConflict: "patient_id,doctor_id" }
  );

  if (error) {
    console.error("[AvailabilityAlerts] Subscribe error:", error);
    return { success: false, error: "Failed to subscribe." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Unsubscribe from a doctor's availability notifications.
 */
export async function unsubscribeFromAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase
    .from("availability_alerts")
    .delete()
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId);

  if (error) {
    console.error("[AvailabilityAlerts] Unsubscribe error:", error);
    return { success: false, error: "Failed to unsubscribe." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Check if the current user is subscribed to a doctor's availability.
 */
export async function getAvailabilityAlert(
  doctorId: string
): Promise<{ subscribed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { subscribed: false };

  const { data } = await supabase
    .from("availability_alerts")
    .select("id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  return { subscribed: !!data };
}

/**
 * Notify patients who have subscribed to a doctor's availability.
 * Called when a doctor adds new availability slots.
 * Should be called from a cron job or availability update action.
 */
export async function notifyAvailabilitySubscribers(
  doctorId: string,
  doctorName: string,
  doctorSlug: string
): Promise<{ notifiedCount: number }> {
  const admin = createAdminClient();

  // Fetch un-notified alerts for this doctor
  const { data: alerts } = await admin
    .from("availability_alerts")
    .select("id, patient_id")
    .eq("doctor_id", doctorId)
    .is("notified_at", null);

  if (!alerts || alerts.length === 0) return { notifiedCount: 0 };

  let notifiedCount = 0;

  for (const alert of alerts) {
    try {
      await createNotification({
        userId: alert.patient_id,
        type: "availability_alert",
        title: "Doctor Now Available",
        message: `${doctorName} has new appointment slots available. Book now before they fill up!`,
        channels: ["in_app", "email"],
        metadata: {
          doctorId,
          doctorSlug,
          doctorName,
        },
      });

      // Mark as notified
      await admin
        .from("availability_alerts")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", alert.id);

      notifiedCount++;
    } catch (err) {
      console.error("[AvailabilityAlerts] Notification error:", err);
    }
  }

  return { notifiedCount };
}
