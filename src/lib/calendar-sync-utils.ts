/**
 * Shared utilities for calendar sync — conflict detection & notification
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

interface SyncedOverride {
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
}

/**
 * After a calendar sync creates availability_overrides, check if any of
 * them conflict with existing confirmed bookings. If so, notify the doctor.
 */
export async function detectAndNotifyConflicts(
  doctorId: string,
  overrides: SyncedOverride[],
  providerLabel: string
): Promise<number> {
  const blocked = overrides.filter((o) => !o.is_available);
  if (blocked.length === 0) return 0;

  const supabase = createAdminClient();

  // Get the doctor's profile_id for notifications
  const { data: doctor } = await supabase
    .from("doctors")
    .select("profile_id")
    .eq("id", doctorId)
    .single();
  if (!doctor) return 0;

  const dates = [...new Set(blocked.map((o) => o.override_date))];

  // Fetch confirmed bookings on the affected dates
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, appointment_date, start_time, end_time, booking_number")
    .eq("doctor_id", doctorId)
    .in("appointment_date", dates)
    .in("status", ["confirmed", "approved", "pending_approval"]);

  if (!bookings || bookings.length === 0) return 0;

  let conflicts = 0;

  for (const booking of bookings) {
    const matchingOverrides = blocked.filter(
      (o) => o.override_date === booking.appointment_date
    );

    for (const override of matchingOverrides) {
      // Full-day block → always conflicts
      if (!override.start_time || !override.end_time) {
        await notifyConflict(
          supabase,
          doctor.profile_id,
          booking,
          providerLabel,
          true
        );
        conflicts++;
        break; // One notification per booking is enough
      }

      // Partial-day block → check time overlap
      if (
        booking.start_time < override.end_time &&
        booking.end_time > override.start_time
      ) {
        await notifyConflict(
          supabase,
          doctor.profile_id,
          booking,
          providerLabel,
          false
        );
        conflicts++;
        break;
      }
    }
  }

  return conflicts;
}

async function notifyConflict(
  _supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  booking: {
    appointment_date: string;
    start_time: string;
    end_time: string;
    booking_number: string;
  },
  providerLabel: string,
  isFullDay: boolean
) {
  const dateStr = new Date(booking.appointment_date).toLocaleDateString(
    "en-GB",
    { weekday: "short", day: "numeric", month: "short" }
  );
  const timeStr = isFullDay
    ? "all day"
    : `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`;

  await createNotification({
    userId: profileId,
    type: "calendar_conflict",
    title: "Scheduling Conflict Detected",
    message: `Booking #${booking.booking_number} on ${dateStr} (${timeStr}) conflicts with a blocked time from your ${providerLabel} calendar. Please review and reschedule if needed.`,
    channels: ["in_app"],
  });
}
