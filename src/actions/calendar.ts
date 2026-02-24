"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopWatching, getValidAccessToken, listCalendars, type GoogleTokens } from "@/lib/google/calendar";
import { importGoogleCalendarEvents, setupCalendarWebhook } from "@/lib/google/sync";

export async function getCalendarConnection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return null;

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("id, provider, calendar_id, sync_enabled, last_synced_at, created_at")
    .eq("doctor_id", doctor.id)
    .eq("provider", "google")
    .single();

  return connection;
}

export async function disconnectCalendar(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { success: false, error: "Not a doctor" };

  // Get full connection to stop webhook
  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctor.id)
    .eq("provider", "google")
    .single();

  if (!connection) return { success: true };

  // Stop webhook if active
  if (connection.webhook_channel_id && connection.webhook_resource_id) {
    try {
      const tokens: GoogleTokens = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.token_expires_at,
      };
      const { access_token } = await getValidAccessToken(tokens);
      await stopWatching(
        access_token,
        connection.webhook_channel_id,
        connection.webhook_resource_id
      );
    } catch (err) {
      console.warn("Failed to stop webhook:", err);
    }
  }

  // Remove google calendar sync overrides
  await adminSupabase
    .from("availability_overrides")
    .delete()
    .eq("doctor_id", doctor.id)
    .eq("reason", "google_calendar_sync");

  // Delete connection
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .delete()
    .eq("id", connection.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function triggerCalendarSync(): Promise<{
  success: boolean;
  eventsProcessed?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { success: false, error: "Not a doctor" };

  return importGoogleCalendarEvents(doctor.id);
}

export async function toggleCalendarSync(enabled: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { success: false, error: "Not a doctor" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ sync_enabled: enabled })
    .eq("doctor_id", doctor.id)
    .eq("provider", "google");

  if (error) return { success: false, error: error.message };

  // If re-enabling, trigger a sync and re-setup webhook
  if (enabled) {
    importGoogleCalendarEvents(doctor.id).catch(console.error);
    setupCalendarWebhook(doctor.id).catch(console.error);
  }

  return { success: true };
}

export async function getCalendarList(): Promise<{
  calendars: { id: string; summary: string; primary: boolean }[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { calendars: [], error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { calendars: [], error: "Not a doctor" };

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("access_token, refresh_token, token_expires_at, id")
    .eq("doctor_id", doctor.id)
    .eq("provider", "google")
    .single();

  if (!connection) return { calendars: [], error: "Not connected" };

  try {
    const tokens: GoogleTokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expires_at: connection.token_expires_at,
    };
    const { access_token, refreshed, new_expires_at } = await getValidAccessToken(tokens);

    if (refreshed && new_expires_at) {
      await adminSupabase
        .from("doctor_calendar_connections")
        .update({ access_token, token_expires_at: new_expires_at })
        .eq("id", connection.id);
    }

    const cals = await listCalendars(access_token);
    return { calendars: cals.map((c) => ({ ...c, primary: c.primary ?? false })) };
  } catch (err) {
    return {
      calendars: [],
      error: err instanceof Error ? err.message : "Failed to list calendars",
    };
  }
}

export async function selectCalendar(calendarId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { success: false, error: "Not a doctor" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ calendar_id: calendarId })
    .eq("doctor_id", doctor.id)
    .eq("provider", "google");

  if (error) return { success: false, error: error.message };

  // Re-sync with the new calendar
  importGoogleCalendarEvents(doctor.id).catch(console.error);
  setupCalendarWebhook(doctor.id).catch(console.error);

  return { success: true };
}
