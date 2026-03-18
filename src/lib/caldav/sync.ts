/**
 * CalDAV Calendar sync logic
 * Import: CalDAV Calendar → Platform (blocked times → availability_overrides)
 * Export: Platform → CalDAV Calendar (bookings → calendar events)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { detectAndNotifyConflicts } from "@/lib/calendar-sync-utils";
import {
  listEvents,
  createEvent,
  deleteEvent,
  type CalDAVCredentials,
} from "./client";
import { log } from "@/lib/utils/logger";

const SYNC_DAYS_AHEAD = 30;

interface CalDAVConnection {
  id: string;
  doctor_id: string;
  caldav_server_url: string;
  caldav_username: string;
  caldav_password: string;
  calendar_id: string; // calendar href
  sync_enabled: boolean;
}

/**
 * Get CalDAV credentials from a connection record
 */
function getCredentials(conn: CalDAVConnection): CalDAVCredentials {
  return {
    serverUrl: conn.caldav_server_url,
    username: conn.caldav_username,
    password: conn.caldav_password,
  };
}

/**
 * Parse a CalDAV datetime string to a Date object.
 * Handles both "20250315T090000Z" and "20250315T090000" formats.
 */
function parseCalDAVDate(dt: string): Date {
  // Remove any trailing Z and parse
  const clean = dt.replace(/Z$/, "");
  if (clean.length >= 15) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11);
    const minute = clean.substring(11, 13);
    const second = clean.substring(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  }
  return new Date(dt);
}

/**
 * Import sync: Read CalDAV Calendar events and create availability_overrides
 */
export async function importCalDAVEvents(
  doctorId: string
): Promise<{ success: boolean; eventsProcessed: number; error?: string }> {
  const supabase = createAdminClient();

  const { data: connection, error: connError } = await supabase
    .from("doctor_calendar_connections")
    .select("*, caldav_server_url, caldav_username, caldav_password")
    .eq("doctor_id", doctorId)
    .eq("provider", "caldav")
    .single();

  if (connError || !connection) {
    return { success: false, eventsProcessed: 0, error: "No CalDAV connection found" };
  }

  const conn = connection as unknown as CalDAVConnection;

  if (!conn.sync_enabled || !conn.calendar_id) {
    return { success: false, eventsProcessed: 0, error: "Sync disabled or no calendar selected" };
  }

  try {
    const credentials = getCredentials(conn);

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000
    ).toISOString();

    const events = await listEvents(credentials, conn.calendar_id, timeMin, timeMax);

    // Remove old caldav_sync overrides
    const todayStr = now.toISOString().split("T")[0];
    await supabase
      .from("availability_overrides")
      .delete()
      .eq("doctor_id", doctorId)
      .eq("reason", "caldav_calendar_sync")
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
      const startDt = parseCalDAVDate(event.dtstart);
      const endDt = parseCalDAVDate(event.dtend);

      // Skip all-day events (date-only format: 8 chars without T)
      if (event.dtstart.length <= 8) continue;

      const dateStr = startDt.toISOString().split("T")[0];
      const startTime = startDt.toTimeString().substring(0, 5);
      const endTime = endDt.toTimeString().substring(0, 5);

      overrides.push({
        doctor_id: doctorId,
        override_date: dateStr,
        is_available: false,
        start_time: startTime,
        end_time: endTime,
        reason: "caldav_calendar_sync",
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
          error: `Failed to create overrides: ${insertError.message}`,
        };
      }
    }

    // Check for conflicts with existing bookings
    if (overrides.length > 0) {
      detectAndNotifyConflicts(doctorId, overrides, "CalDAV").catch((err) =>
        log.error("Conflict detection error:", { err: err })
      );
    }

    await supabase
      .from("doctor_calendar_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);

    return { success: true, eventsProcessed: events.length };
  } catch (err) {
    log.error("CalDAV import sync error:", { err: err });
    return {
      success: false,
      eventsProcessed: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Export a booking to CalDAV Calendar
 */
export async function exportBookingToCalDAV(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      start_time,
      end_time,
      consultation_type,
      patient_notes,
      caldav_event_uid,
      doctor_id,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name)
    `
    )
    .eq("id", bookingId)
    .single();

  if (!booking) return { success: false, error: "Booking not found" };
  if ((booking as any).caldav_event_uid) return { success: true };

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*, caldav_server_url, caldav_username, caldav_password")
    .eq("doctor_id", booking.doctor_id)
    .eq("provider", "caldav")
    .single();

  if (!connection || !connection.sync_enabled || !connection.calendar_id) {
    return { success: true }; // No connection — skip
  }

  const conn = connection as unknown as CalDAVConnection;

  try {
    const credentials = getCredentials(conn);
    const patient: any = Array.isArray(booking.patient)
      ? booking.patient[0]
      : booking.patient;
    const patientName = `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim();
    const type = booking.consultation_type === "video" ? "Video" : "In-Person";
    const uid = `mydoctor-${booking.id}`;

    await createEvent(credentials, conn.calendar_id, {
      uid,
      summary: `${type} Appointment — ${patientName}`,
      description: `Booking #${booking.booking_number}\nPatient: ${patientName}\nType: ${type}${booking.patient_notes ? `\nNotes: ${booking.patient_notes}` : ""}`,
      dtstart: new Date(booking.start_time),
      dtend: new Date(booking.end_time),
    });

    await supabase
      .from("bookings")
      .update({ caldav_event_uid: uid })
      .eq("id", bookingId);

    return { success: true };
  } catch (err) {
    log.error("Export booking to CalDAV error:", { err: err });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a booking event from CalDAV Calendar
 */
export async function removeBookingFromCalDAV(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, caldav_event_uid, doctor_id")
    .eq("id", bookingId)
    .single();

  if (!booking || !(booking as any).caldav_event_uid) {
    return { success: true };
  }

  const { data: connection } = await supabase
    .from("doctor_calendar_connections")
    .select("*, caldav_server_url, caldav_username, caldav_password")
    .eq("doctor_id", booking.doctor_id)
    .eq("provider", "caldav")
    .single();

  if (!connection || !connection.calendar_id) {
    return { success: true };
  }

  const conn = connection as unknown as CalDAVConnection;

  try {
    const credentials = getCredentials(conn);
    const eventHref = `${conn.calendar_id}${(booking as any).caldav_event_uid}.ics`;
    await deleteEvent(credentials, eventHref);

    await supabase
      .from("bookings")
      .update({ caldav_event_uid: null })
      .eq("id", bookingId);

    return { success: true };
  } catch (err) {
    log.error("Remove CalDAV event error:", { err: err });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Sync all connected CalDAV doctors (for cron job)
 */
export async function syncAllCalDAVDoctors(): Promise<{
  synced: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: connections } = await supabase
    .from("doctor_calendar_connections")
    .select("doctor_id")
    .eq("provider", "caldav")
    .eq("sync_enabled", true)
    .not("calendar_id", "is", null);

  if (!connections || connections.length === 0) {
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const conn of connections) {
    const result = await importCalDAVEvents(conn.doctor_id);
    if (result.success) {
      synced++;
    } else {
      errors++;
      log.error("CalDAV sync failed", { doctorId: conn.doctor_id, error: result.error });
    }
  }

  return { synced, errors };
}
