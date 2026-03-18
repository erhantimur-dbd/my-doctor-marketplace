"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopWatching, getValidAccessToken as getGoogleToken, listCalendars as listGoogleCalendars, type GoogleTokens } from "@/lib/google/calendar";
import { importGoogleCalendarEvents, setupCalendarWebhook as setupGoogleWebhook } from "@/lib/google/sync";
import { getValidAccessToken as getMicrosoftToken, listCalendars as listMicrosoftCalendars, deleteSubscription, type MicrosoftTokens } from "@/lib/microsoft/calendar";
import { importMicrosoftCalendarEvents, setupMicrosoftWebhook } from "@/lib/microsoft/sync";
import { testConnection as testCalDAV, listCalendars as listCalDAVCalendars, CALDAV_PROVIDERS, type CalDAVProvider, type CalDAVCredentials } from "@/lib/caldav/client";
import { importCalDAVEvents } from "@/lib/caldav/sync";
import crypto from "crypto";
import { log } from "@/lib/utils/logger";

// ---- Helpers ----
async function getDoctorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  return doctor?.id || null;
}

// ---- Google Calendar ----

export async function getCalendarConnection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export async function disconnectCalendar(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!doctor) return { success: false, error: "Not a doctor" };

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctor.id)
    .eq("provider", "google")
    .single();

  if (!connection) return { success: true };

  if (connection.webhook_channel_id && connection.webhook_resource_id) {
    try {
      const tokens: GoogleTokens = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.token_expires_at,
      };
      const { access_token } = await getGoogleToken(tokens);
      await stopWatching(access_token, connection.webhook_channel_id, connection.webhook_resource_id);
    } catch (err) {
      log.warn("Failed to stop Google webhook:", { err: err });
    }
  }

  await adminSupabase
    .from("availability_overrides")
    .delete()
    .eq("doctor_id", doctor.id)
    .eq("reason", "google_calendar_sync");

  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .delete()
    .eq("id", connection.id);

  if (error) return { success: false, error: safeError(error) };
  return { success: true };
}

export async function triggerCalendarSync(): Promise<{ success: boolean; eventsProcessed?: number; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };
  return importGoogleCalendarEvents(doctorId);
}

export async function toggleCalendarSync(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ sync_enabled: enabled })
    .eq("doctor_id", doctorId)
    .eq("provider", "google");

  if (error) return { success: false, error: safeError(error) };

  if (enabled) {
    importGoogleCalendarEvents(doctorId).catch((err) => log.error("Google calendar import failed", { err }));
    setupGoogleWebhook(doctorId).catch((err) => log.error("Google webhook setup failed", { err }));
  }

  return { success: true };
}

export async function getCalendarList(): Promise<{ calendars: { id: string; summary: string; primary: boolean }[]; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { calendars: [], error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("access_token, refresh_token, token_expires_at, id")
    .eq("doctor_id", doctorId)
    .eq("provider", "google")
    .single();

  if (!connection) return { calendars: [], error: "Not connected" };

  try {
    const tokens: GoogleTokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expires_at: connection.token_expires_at,
    };
    const { access_token, refreshed, new_expires_at } = await getGoogleToken(tokens);

    if (refreshed && new_expires_at) {
      await adminSupabase
        .from("doctor_calendar_connections")
        .update({ access_token, token_expires_at: new_expires_at })
        .eq("id", connection.id);
    }

    const cals = await listGoogleCalendars(access_token);
    return { calendars: cals.map((c) => ({ ...c, primary: c.primary ?? false })) };
  } catch (err) {
    return { calendars: [], error: safeError(err) };
  }
}

export async function selectCalendar(calendarId: string): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ calendar_id: calendarId })
    .eq("doctor_id", doctorId)
    .eq("provider", "google");

  if (error) return { success: false, error: safeError(error) };

  importGoogleCalendarEvents(doctorId).catch((err) => log.error("Google calendar import failed", { err }));
  setupGoogleWebhook(doctorId).catch((err) => log.error("Google webhook setup failed", { err }));

  return { success: true };
}

// ---- Microsoft Calendar ----

export async function getMicrosoftCalendarConnection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    .eq("provider", "microsoft")
    .single();

  return connection;
}

export async function disconnectMicrosoftCalendar(): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft")
    .single();

  if (!connection) return { success: true };

  if (connection.webhook_channel_id) {
    try {
      const tokens: MicrosoftTokens = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.token_expires_at,
      };
      const { access_token } = await getMicrosoftToken(tokens);
      await deleteSubscription(access_token, connection.webhook_channel_id);
    } catch (err) {
      log.warn("Failed to delete Microsoft subscription:", { err: err });
    }
  }

  await adminSupabase
    .from("availability_overrides")
    .delete()
    .eq("doctor_id", doctorId)
    .eq("reason", "microsoft_calendar_sync");

  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .delete()
    .eq("id", connection.id);

  if (error) return { success: false, error: safeError(error) };
  return { success: true };
}

export async function triggerMicrosoftCalendarSync(): Promise<{ success: boolean; eventsProcessed?: number; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };
  return importMicrosoftCalendarEvents(doctorId);
}

export async function toggleMicrosoftCalendarSync(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ sync_enabled: enabled })
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft");

  if (error) return { success: false, error: safeError(error) };

  if (enabled) {
    importMicrosoftCalendarEvents(doctorId).catch((err) => log.error("Microsoft calendar import failed", { err }));
    setupMicrosoftWebhook(doctorId).catch((err) => log.error("Microsoft webhook setup failed", { err }));
  }

  return { success: true };
}

export async function getMicrosoftCalendarList(): Promise<{ calendars: { id: string; name: string; isDefault: boolean }[]; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { calendars: [], error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("access_token, refresh_token, token_expires_at, id")
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft")
    .single();

  if (!connection) return { calendars: [], error: "Not connected" };

  try {
    const tokens: MicrosoftTokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expires_at: connection.token_expires_at,
    };
    const { access_token, refreshed, new_expires_at, new_refresh_token } = await getMicrosoftToken(tokens);

    if (refreshed) {
      const updateData: Record<string, string> = { access_token };
      if (new_expires_at) updateData.token_expires_at = new_expires_at;
      if (new_refresh_token) updateData.refresh_token = new_refresh_token;
      await adminSupabase
        .from("doctor_calendar_connections")
        .update(updateData)
        .eq("id", connection.id);
    }

    const cals = await listMicrosoftCalendars(access_token);
    return { calendars: cals.map((c) => ({ ...c, isDefault: c.isDefaultCalendar ?? false })) };
  } catch (err) {
    return { calendars: [], error: safeError(err) };
  }
}

export async function selectMicrosoftCalendar(calendarId: string): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ calendar_id: calendarId })
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft");

  if (error) return { success: false, error: safeError(error) };

  importMicrosoftCalendarEvents(doctorId).catch((err) => log.error("Microsoft calendar import failed", { err }));
  setupMicrosoftWebhook(doctorId).catch((err) => log.error("Microsoft webhook setup failed", { err }));

  return { success: true };
}

// ---- ICS Feed ----

export async function getIcsFeedUrl(): Promise<{ url: string | null; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { url: null, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { data: doctor } = await adminSupabase
    .from("doctors")
    .select("ics_feed_token")
    .eq("id", doctorId)
    .single();

  if (!doctor?.ics_feed_token) return { url: null };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { url: `${baseUrl}/api/calendar/feed/${doctor.ics_feed_token}` };
}

export async function generateIcsFeedToken(): Promise<{ url: string; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { url: "", error: "Not authenticated" };

  const token = crypto.randomBytes(32).toString("hex");

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctors")
    .update({ ics_feed_token: token })
    .eq("id", doctorId);

  if (error) return { url: "", error: safeError(error) };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { url: `${baseUrl}/api/calendar/feed/${token}` };
}

export async function revokeIcsFeedToken(): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctors")
    .update({ ics_feed_token: null })
    .eq("id", doctorId);

  if (error) return { success: false, error: safeError(error) };
  return { success: true };
}

// ---- CalDAV (Apple iCloud, Fastmail, Nextcloud, etc.) ----

export async function getCalDAVConnection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!doctor) return null;

  const adminSupabase = createAdminClient();
  const { data: connection } = await adminSupabase
    .from("doctor_calendar_connections")
    .select("id, provider, calendar_id, sync_enabled, last_synced_at, caldav_provider, caldav_server_url, caldav_username, created_at")
    .eq("doctor_id", doctor.id)
    .eq("provider", "caldav")
    .single();

  return connection;
}

export async function connectCalDAV(
  providerKey: string,
  serverUrl: string,
  username: string,
  password: string
): Promise<{ success: boolean; calendars: { href: string; displayName: string }[]; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, calendars: [], error: "Not authenticated" };

  const credentials: CalDAVCredentials = { serverUrl, username, password };

  // Test connection
  const testResult = await testCalDAV(credentials);
  if (!testResult.success) {
    return { success: false, calendars: [], error: testResult.error || "Connection failed. Check your credentials." };
  }

  // Store connection
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .upsert(
      {
        doctor_id: doctorId,
        provider: "caldav",
        caldav_provider: providerKey,
        caldav_server_url: serverUrl,
        caldav_username: username,
        caldav_password: password,
        access_token: "caldav",
        refresh_token: "caldav",
        token_expires_at: new Date("2099-12-31").toISOString(),
        sync_enabled: true,
        calendar_id: testResult.calendars[0]?.href || null,
      },
      { onConflict: "doctor_id,provider" }
    );

  if (error) return { success: false, calendars: [], error: safeError(error) };

  if (testResult.calendars[0]?.href) {
    importCalDAVEvents(doctorId).catch((err) => log.error("CalDAV import failed", { err }));
  }

  return { success: true, calendars: testResult.calendars };
}

export async function disconnectCalDAV(): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();

  await adminSupabase
    .from("availability_overrides")
    .delete()
    .eq("doctor_id", doctorId)
    .eq("reason", "caldav_calendar_sync");

  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .delete()
    .eq("doctor_id", doctorId)
    .eq("provider", "caldav");

  if (error) return { success: false, error: safeError(error) };
  return { success: true };
}

export async function triggerCalDAVSync(): Promise<{ success: boolean; eventsProcessed?: number; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };
  return importCalDAVEvents(doctorId);
}

export async function toggleCalDAVSync(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ sync_enabled: enabled })
    .eq("doctor_id", doctorId)
    .eq("provider", "caldav");

  if (error) return { success: false, error: safeError(error) };

  if (enabled) {
    importCalDAVEvents(doctorId).catch((err) => log.error("CalDAV import failed", { err }));
  }

  return { success: true };
}

export async function selectCalDAVCalendar(calendarHref: string): Promise<{ success: boolean; error?: string }> {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("doctor_calendar_connections")
    .update({ calendar_id: calendarHref })
    .eq("doctor_id", doctorId)
    .eq("provider", "caldav");

  if (error) return { success: false, error: safeError(error) };

  importCalDAVEvents(doctorId).catch((err) => log.error("CalDAV import failed", { err }));

  return { success: true };
}

export async function getCalDAVProviders() {
  return CALDAV_PROVIDERS;
}

// ---- Sync All ----

export async function triggerAllCalendarSyncs() {
  const doctorId = await getDoctorId();
  if (!doctorId) return { success: false, error: "Not authenticated" };

  const results = await Promise.allSettled([
    importGoogleCalendarEvents(doctorId),
    importMicrosoftCalendarEvents(doctorId),
    importCalDAVEvents(doctorId),
  ]);

  const synced = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  const errors = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)
  ).length;

  return { success: true, synced, errors };
}
