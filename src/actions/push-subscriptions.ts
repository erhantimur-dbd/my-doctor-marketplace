"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Save a push subscription for the current user.
 */
export async function savePushSubscription(data: PushSubscriptionData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Remove a push subscription.
 */
export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Check if the current user has push subscriptions.
 */
export async function hasPushSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const adminDb = createAdminClient();
  const { count } = await adminDb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (count || 0) > 0;
}

/**
 * Get push subscriptions for a user (for sending notifications).
 */
export async function getUserPushSubscriptions(userId: string) {
  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  return data || [];
}
