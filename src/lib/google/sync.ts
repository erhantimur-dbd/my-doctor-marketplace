/**
 * Google Calendar sync logic
 * Import: Google Calendar → Platform (blocked times → availability_overrides)
 * Export: Platform → Google Calendar (bookings → calendar events)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getValidAccessToken,
  listEvents,
  createEvent,
  deleteEvent,
  watchCalendar,
  type GoogleTokens,
} from "./calendar";

const SYNC_DAYS_AHEAD = 30;

interface CalendarConnection {
  id: string;
  doctor_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string;
  sync_enabled: boolean;
  webhook_channel_id: string | null;
  webhook_resource_id: string | null;
  webhook_expiration: string | null;
}

/**
 * Import sync: Read Google Calendar events and create availability_overrides
 * for busy times so those slots become unavailable on the platform.
 */
export async function importGoogleCalendarEvents(
  doctorId: string
): Promise<{ success: boolean; eventsProcessed: number; error?: string }> {
  const supabase = createAdminClient();

  // Get calendar connection
  const { data: connection, error: connError } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "google")
    .single();

  if (connError || !connection) {
    return { success: false, eventsProcessed: 0, error: "No calendar connection found" };
  }

  const conn = connection as CalendarConnection;

  if (!conn.sync_enabled || !conn.calendar_id) {
    return { success: false, eventsProcessed: 0, error: "Sync disabled or no calendar selected" };
  }

  try {
    // Get valid access token (refresh if needed)
    const tokens: GoogleTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at } =
      await getValidAccessToken(tokens);

    // Update tokens if refreshed
    if (refreshed && new_expires_at) {
      await supabase
        .from("doctor_calendar_connections")
        .update({
          access_token,
          token_expires_at: new_expires_at,
        })
        .eq("id", conn.id);
    }

    // Fetch events for the next 30 days
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000
    ).toISOString();

    const events = await listEvents(
      access_token,
      conn.calendar_id,
      timeMin,
      timeMax
    );

    // Remove old google_calendar_sync overrides for this doctor (for upcoming dates only)
    const todayStr = now.toISOString().split("T")[0];
    await supabase
      .from("availability_overrides")
      .delete()
      .eq("doctor_id", doctorId)
      .eq("reason", "google_calendar_sync")
      .gte("override_date", todayStr);

    // Group events by date and create overrides for each busy period
    const overrides: {
      doctor_id: string;
      override_date: string;
      is_available: boolean;
      custom_start: string;
      custom_end: string;
      reason: string;
    }[] = [];

    for (const event of events) {
      if (!event.start.dateTime || !event.end.dateTime) continue; // Skip all-day events

      const startDt = new Date(event.start.dateTime);
      const endDt = new Date(event.end.dateTime);
      const dateStr = startDt.toISOString().split("T")[0];
      const startTime = startDt.toTimeString().substring(0, 5); // "HH:MM"
      const endTime = endDt.toTimeString().substring(0, 5);

      overrides.push({
        doctor_id: doctorId,
        override_date: dateStr,
        is_available: false,
        custom_start: startTime,
        custom_end: endTime,
        reason: "google_calendar_sync",
      });
    }

    // Batch insert overrides
    if (overrides.length > 0) {
      const { error: insertError } = await supabase
        .from("availability_overrides")
        .insert(overrides);

      if (insertError) {
        console.error("Failed to insert overrides:", insertError);
        return {
          success: false,
          eventsProcessed: 0,
          error: `Failed to create availability overrides: ${insertError.message}`,
        };
      }
    }

    // Update last_synced_at
    await supabase
      .from("doctor_calendar_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);

    return { success: true, eventsProcessed: events.length };
  } catch (err) {
    console.error("Import sync error:", err);
    return {
      success: false,
      eventsProcessed: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Export a booking to Google Calendar as an event
 */
export async function exportBookingToGoogleCalendar(
  bookingId: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const supabase = createAdminClient();

  // Fetch booking with doctor info
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      patient_notes,
      google_event_id,
      doctor_id,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name),
      doctor:doctors!inner(
        id,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name),
        location:locations(timezone)
      )
    `
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return { success: false, error: "Booking not found" };
  }

  // Already exported?
  if (booking.google_event_id) {
    return { success: true, eventId: booking.google_event_id };
  }

  const doctorData: Record<string, unknown> = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  const doctorId = doctorData.id as string;

  // Get calendar connection
  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "google")
    .single();

  if (!connection || !connection.sync_enabled || !connection.calendar_id) {
    // No connection — not an error, just skip
    return { success: true };
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: GoogleTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at } =
      await getValidAccessToken(tokens);

    if (refreshed && new_expires_at) {
      await supabase
        .from("doctor_calendar_connections")
        .update({ access_token, token_expires_at: new_expires_at })
        .eq("id", conn.id);
    }

    // Build event
    const patientData: Record<string, unknown> = Array.isArray(booking.patient)
      ? booking.patient[0]
      : booking.patient;
    const patientName = `${patientData.first_name} ${patientData.last_name}`;
    const consultationType =
      booking.consultation_type === "video" ? "Video" : "In-Person";

    const locationData: Record<string, unknown> = Array.isArray(
      (doctorData as Record<string, unknown>).location
    )
      ? ((doctorData as Record<string, unknown>).location as Record<string, unknown>[])[0]
      : (doctorData as Record<string, unknown>).location as Record<string, unknown>;
    const timezone = (locationData?.timezone as string) || "Europe/London";

    const event = await createEvent(access_token, conn.calendar_id, {
      summary: `${consultationType} Appointment — ${patientName}`,
      description: `Booking #${booking.booking_number}\nPatient: ${patientName}\nType: ${consultationType}${booking.patient_notes ? `\nNotes: ${booking.patient_notes}` : ""}`,
      start: {
        dateTime: booking.start_time,
        timeZone: timezone,
      },
      end: {
        dateTime: booking.end_time,
        timeZone: timezone,
      },
    });

    // Store event ID on booking
    if (event.id) {
      await supabase
        .from("bookings")
        .update({ google_event_id: event.id })
        .eq("id", bookingId);
    }

    return { success: true, eventId: event.id };
  } catch (err) {
    console.error("Export booking to Google Calendar error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a booking event from Google Calendar (on cancellation)
 */
export async function removeBookingFromGoogleCalendar(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, google_event_id, doctor_id")
    .eq("id", bookingId)
    .single();

  if (!booking || !booking.google_event_id) {
    return { success: true }; // Nothing to remove
  }

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", booking.doctor_id)
    .eq("provider", "google")
    .single();

  if (!connection || !connection.calendar_id) {
    return { success: true };
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: GoogleTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at } =
      await getValidAccessToken(tokens);

    if (refreshed && new_expires_at) {
      await supabase
        .from("doctor_calendar_connections")
        .update({ access_token, token_expires_at: new_expires_at })
        .eq("id", conn.id);
    }

    await deleteEvent(access_token, conn.calendar_id, booking.google_event_id);

    // Clear event ID
    await supabase
      .from("bookings")
      .update({ google_event_id: null })
      .eq("id", bookingId);

    return { success: true };
  } catch (err) {
    console.error("Remove Google Calendar event error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Set up a push notification webhook for a doctor's calendar
 */
export async function setupCalendarWebhook(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "google")
    .single();

  if (!connection || !connection.calendar_id) {
    return { success: false, error: "No calendar connection" };
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: GoogleTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at } =
      await getValidAccessToken(tokens);

    if (refreshed && new_expires_at) {
      await supabase
        .from("doctor_calendar_connections")
        .update({ access_token, token_expires_at: new_expires_at })
        .eq("id", conn.id);
    }

    const channelId = `mydoctor-${doctorId}-${Date.now()}`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`;

    const watch = await watchCalendar(
      access_token,
      conn.calendar_id,
      channelId,
      webhookUrl
    );

    await supabase
      .from("doctor_calendar_connections")
      .update({
        webhook_channel_id: watch.id,
        webhook_resource_id: watch.resourceId,
        webhook_expiration: watch.expiration,
      })
      .eq("id", conn.id);

    return { success: true };
  } catch (err) {
    console.error("Setup webhook error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Sync all connected doctors (for cron job)
 */
export async function syncAllConnectedDoctors(): Promise<{
  synced: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: connections } = await supabase
    .from("doctor_calendar_connections")
    .select("doctor_id")
    .eq("sync_enabled", true)
    .not("calendar_id", "is", null);

  if (!connections || connections.length === 0) {
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const conn of connections) {
    const result = await importGoogleCalendarEvents(conn.doctor_id);
    if (result.success) {
      synced++;
    } else {
      errors++;
      console.error(
        `Sync failed for doctor ${conn.doctor_id}: ${result.error}`
      );
    }
  }

  return { synced, errors };
}
