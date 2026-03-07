/**
 * Microsoft Calendar sync logic
 * Import: Microsoft Calendar → Platform (blocked times → availability_overrides)
 * Export: Platform → Microsoft Calendar (bookings → calendar events)
 * Mirrors the Google Calendar sync pattern.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { detectAndNotifyConflicts } from "@/lib/calendar-sync-utils";
import {
  getValidAccessToken,
  listEvents,
  createEvent,
  deleteEvent,
  createSubscription,
  type MicrosoftTokens,
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
 * Import sync: Read Microsoft Calendar events and create availability_overrides
 */
export async function importMicrosoftCalendarEvents(
  doctorId: string
): Promise<{ success: boolean; eventsProcessed: number; error?: string }> {
  const supabase = createAdminClient();

  const { data: connection, error: connError } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft")
    .single();

  if (connError || !connection) {
    return { success: false, eventsProcessed: 0, error: "No calendar connection found" };
  }

  const conn = connection as CalendarConnection;

  if (!conn.sync_enabled || !conn.calendar_id) {
    return { success: false, eventsProcessed: 0, error: "Sync disabled or no calendar selected" };
  }

  try {
    const tokens: MicrosoftTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at, new_refresh_token } =
      await getValidAccessToken(tokens);

    if (refreshed) {
      const updateData: Record<string, string> = { access_token };
      if (new_expires_at) updateData.token_expires_at = new_expires_at;
      if (new_refresh_token) updateData.refresh_token = new_refresh_token;
      await supabase
        .from("doctor_calendar_connections")
        .update(updateData)
        .eq("id", conn.id);
    }

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000
    ).toISOString();

    const events = await listEvents(access_token, conn.calendar_id, timeMin, timeMax);

    // Remove old microsoft_calendar_sync overrides
    const todayStr = now.toISOString().split("T")[0];
    await supabase
      .from("availability_overrides")
      .delete()
      .eq("doctor_id", doctorId)
      .eq("reason", "microsoft_calendar_sync")
      .gte("override_date", todayStr);

    const overrides: {
      doctor_id: string;
      override_date: string;
      is_available: boolean;
      start_time: string;
      end_time: string;
      reason: string;
    }[] = [];

    for (const event of events) {
      if (!event.start.dateTime || !event.end.dateTime) continue;

      const startDt = new Date(event.start.dateTime + "Z"); // MS Graph returns UTC when we request it
      const endDt = new Date(event.end.dateTime + "Z");
      const dateStr = startDt.toISOString().split("T")[0];
      const startTime = startDt.toTimeString().substring(0, 5);
      const endTime = endDt.toTimeString().substring(0, 5);

      overrides.push({
        doctor_id: doctorId,
        override_date: dateStr,
        is_available: false,
        start_time: startTime,
        end_time: endTime,
        reason: "microsoft_calendar_sync",
      });
    }

    if (overrides.length > 0) {
      const { error: insertError } = await supabase
        .from("availability_overrides")
        .insert(overrides);

      if (insertError) {
        return {
          success: false,
          eventsProcessed: 0,
          error: `Failed to create availability overrides: ${insertError.message}`,
        };
      }
    }

    // Check for conflicts with existing bookings
    if (overrides.length > 0) {
      detectAndNotifyConflicts(doctorId, overrides, "Microsoft").catch((err) =>
        console.error("Conflict detection error:", err)
      );
    }

    await supabase
      .from("doctor_calendar_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);

    return { success: true, eventsProcessed: events.length };
  } catch (err) {
    console.error("Microsoft import sync error:", err);
    return {
      success: false,
      eventsProcessed: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Export a booking to Microsoft Calendar as an event
 */
export async function exportBookingToMicrosoftCalendar(
  bookingId: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const supabase = createAdminClient();

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
      microsoft_event_id,
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

  if ((booking as any).microsoft_event_id) {
    return { success: true, eventId: (booking as any).microsoft_event_id };
  }

  const doctorData: any = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  const doctorId = doctorData.id as string;

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft")
    .single();

  if (!connection || !connection.sync_enabled || !connection.calendar_id) {
    return { success: true }; // No connection — skip
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: MicrosoftTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at, new_refresh_token } =
      await getValidAccessToken(tokens);

    if (refreshed) {
      const updateData: Record<string, string> = { access_token };
      if (new_expires_at) updateData.token_expires_at = new_expires_at;
      if (new_refresh_token) updateData.refresh_token = new_refresh_token;
      await supabase
        .from("doctor_calendar_connections")
        .update(updateData)
        .eq("id", conn.id);
    }

    const patientData: any = Array.isArray(booking.patient)
      ? booking.patient[0]
      : booking.patient;
    const patientName = `${patientData.first_name} ${patientData.last_name}`;
    const consultationType =
      booking.consultation_type === "video" ? "Video" : "In-Person";

    const locationData: any = Array.isArray(doctorData.location)
      ? doctorData.location[0]
      : doctorData.location;
    const timezone = locationData?.timezone || "UTC";

    const event = await createEvent(access_token, conn.calendar_id, {
      subject: `${consultationType} Appointment — ${patientName}`,
      body: {
        contentType: "text",
        content: `Booking #${booking.booking_number}\nPatient: ${patientName}\nType: ${consultationType}${booking.patient_notes ? `\nNotes: ${booking.patient_notes}` : ""}`,
      },
      start: { dateTime: booking.start_time, timeZone: timezone },
      end: { dateTime: booking.end_time, timeZone: timezone },
    });

    if (event.id) {
      await supabase
        .from("bookings")
        .update({ microsoft_event_id: event.id })
        .eq("id", bookingId);
    }

    return { success: true, eventId: event.id };
  } catch (err) {
    console.error("Export booking to Microsoft Calendar error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a booking event from Microsoft Calendar
 */
export async function removeBookingFromMicrosoftCalendar(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, microsoft_event_id, doctor_id")
    .eq("id", bookingId)
    .single();

  if (!booking || !(booking as any).microsoft_event_id) {
    return { success: true };
  }

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", booking.doctor_id)
    .eq("provider", "microsoft")
    .single();

  if (!connection || !connection.calendar_id) {
    return { success: true };
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: MicrosoftTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at, new_refresh_token } =
      await getValidAccessToken(tokens);

    if (refreshed) {
      const updateData: Record<string, string> = { access_token };
      if (new_expires_at) updateData.token_expires_at = new_expires_at;
      if (new_refresh_token) updateData.refresh_token = new_refresh_token;
      await supabase
        .from("doctor_calendar_connections")
        .update(updateData)
        .eq("id", conn.id);
    }

    await deleteEvent(access_token, (booking as any).microsoft_event_id);

    await supabase
      .from("bookings")
      .update({ microsoft_event_id: null })
      .eq("id", bookingId);

    return { success: true };
  } catch (err) {
    console.error("Remove Microsoft Calendar event error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Set up a webhook subscription for a doctor's Microsoft calendar
 */
export async function setupMicrosoftWebhook(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("provider", "microsoft")
    .single();

  if (!connection || !connection.calendar_id) {
    return { success: false, error: "No calendar connection" };
  }

  const conn = connection as CalendarConnection;

  try {
    const tokens: MicrosoftTokens = {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at,
    };

    const { access_token, refreshed, new_expires_at, new_refresh_token } =
      await getValidAccessToken(tokens);

    if (refreshed) {
      const updateData: Record<string, string> = { access_token };
      if (new_expires_at) updateData.token_expires_at = new_expires_at;
      if (new_refresh_token) updateData.refresh_token = new_refresh_token;
      await supabase
        .from("doctor_calendar_connections")
        .update(updateData)
        .eq("id", conn.id);
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/microsoft-calendar`;

    const sub = await createSubscription(
      access_token,
      conn.calendar_id,
      webhookUrl
    );

    await supabase
      .from("doctor_calendar_connections")
      .update({
        webhook_channel_id: sub.id,
        webhook_expiration: sub.expirationDateTime,
      })
      .eq("id", conn.id);

    return { success: true };
  } catch (err) {
    console.error("Setup Microsoft webhook error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Sync all connected Microsoft Calendar doctors (for cron job)
 */
export async function syncAllMicrosoftDoctors(): Promise<{
  synced: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: connections } = await supabase
    .from("doctor_calendar_connections")
    .select("doctor_id")
    .eq("provider", "microsoft")
    .eq("sync_enabled", true)
    .not("calendar_id", "is", null);

  if (!connections || connections.length === 0) {
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const conn of connections) {
    const result = await importMicrosoftCalendarEvents(conn.doctor_id);
    if (result.success) {
      synced++;
    } else {
      errors++;
      console.error(
        `Microsoft sync failed for doctor ${conn.doctor_id}: ${result.error}`
      );
    }
  }

  return { synced, errors };
}
