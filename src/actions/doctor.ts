"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

export async function connectStripeAccount() {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return;

  const stripe = (await import("@/lib/stripe/client")).getStripe();

  let accountId = doctor.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { doctor_id: doctor.id },
    });
    accountId = account.id;

    await supabase
      .from("doctors")
      .update({ stripe_account_id: accountId })
      .eq("id", doctor.id);
  }

  const { getRequestOrigin } = await import("@/lib/http/origin");
  const origin = await getRequestOrigin();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/en/doctor-dashboard/payments`,
    return_url: `${origin}/en/doctor-dashboard/payments`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}

// ---------------------------------------------------------------------------
// Reminder Preferences
// ---------------------------------------------------------------------------

export interface ReminderPreference {
  id?: string;
  minutes_before: number;
  channel: "email" | "in_app";
  is_enabled: boolean;
}

export async function getDoctorReminderPreferences(): Promise<{
  data?: ReminderPreference[];
  error?: string;
}> {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError || "Not authorized" };

  const { data, error } = await supabase
    .from("doctor_reminder_preferences")
    .select("id, minutes_before, channel, is_enabled")
    .eq("doctor_id", doctor.id)
    .order("minutes_before", { ascending: false });

  if (error) return { error: safeError(error) };
  return { data: data as ReminderPreference[] };
}

export async function saveDoctorReminderPreferences(
  prefs: ReminderPreference[]
): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError || "Not authorized" };

  // Delete existing preferences and re-insert (atomic replace)
  const { error: deleteError } = await supabase
    .from("doctor_reminder_preferences")
    .delete()
    .eq("doctor_id", doctor.id);

  if (deleteError) return { error: safeError(deleteError) };

  if (prefs.length > 0) {
    const rows = prefs.map((p) => ({
      doctor_id: doctor.id,
      minutes_before: p.minutes_before,
      channel: p.channel,
      is_enabled: p.is_enabled,
    }));

    const { error: insertError } = await supabase
      .from("doctor_reminder_preferences")
      .insert(rows);

    if (insertError) return { error: safeError(insertError) };
  }

  revalidatePath("/doctor-dashboard/settings");
  return { success: true };
}
